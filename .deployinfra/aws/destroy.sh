#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a
# Strip Windows CRLF line endings before sourcing: if .env.deploy was ever
# saved with \r\n (e.g. edited on Windows), a plain `source` embeds a
# trailing \r into every variable's value. AWS's EC2 API is XML-based and
# rejects that raw control character with "InvalidCharacter" errors that
# look nothing like their actual cause.
source <(tr -d '\r' < "$PROJECT_ROOT/.env.deploy")
set +a

# ── Color helpers (matches aws.ecr.sh / csg.sh / rd.sh / lk.sh / sm.sh) ─
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color (reset)

log_step() { echo -e "\n${BLUE}${BOLD}[ STEP $1 ]${NC} ${CYAN}$2${NC}"; }
log_ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
log_err()  { echo -e "  ${RED}✘  ERROR: $1${NC}"; exit 1; }

# ── Spinner ─────────────────────────────────────────────────────
# See csg.sh for the full explanation of why `tput` must be redirected
# to `>&2` here (otherwise its cursor escape codes silently contaminate
# whatever this function's stdout gets captured into).
run() {
  local label="$1"; shift
  local tmp_out tmp_err pid frame=0
  local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  tmp_out="$(mktemp)"
  tmp_err="$(mktemp)"

  ("$@" >"$tmp_out" 2>"$tmp_err") &
  pid=$!

  tput civis >&2 2>/dev/null || true
  while kill -0 "$pid" 2>/dev/null; do
    frame=$(( (frame + 1) % ${#spinstr} ))
    printf "\r  ${CYAN}%s${NC} %s" "${spinstr:$frame:1}" "$label" >&2
    sleep 0.08
  done
  tput cnorm >&2 2>/dev/null || true

  if wait "$pid"; then
    printf "\r  ${GREEN}✔${NC} %s\n" "$label" >&2
  else
    printf "\r  ${RED}✘${NC} %s\n" "$label" >&2
    cat "$tmp_err" >&2
    rm -f "$tmp_out" "$tmp_err"
    exit 1
  fi

  cat "$tmp_out"
  rm -f "$tmp_out" "$tmp_err"
}

# Finds every non-terminated instance carrying a given Name tag.
# Deliberately uses Reservations[*].Instances[*] rather than [0].[0]: if a
# deploy script was ever run twice there will be more than one instance with
# that tag, and matching only the first would silently leave the rest running
# (and billing) after a "full" destroy.
find_instances() {
  aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --filters \
      "Name=tag:Name,Values=$1" \
      "Name=instance-state-name,Values=pending,running,stopping,stopped" \
    --query "Reservations[*].Instances[*].InstanceId" \
    --output text
}

find_sg() {
  aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=group-name,Values=$1" \
    --query "SecurityGroups[0].GroupId" \
    --output text 2>/dev/null || echo "None"
}

# Deletes a security group, retrying on DependencyViolation. An instance
# reaching the "terminated" state does not mean its elastic network
# interface has detached yet, and AWS refuses to delete a group while any
# ENI still references it — so a first attempt failing here is normal and
# just needs a few seconds, not an abort.
delete_sg() {
  local sg_id="$1" sg_name="$2"
  local attempt=1 max=6 err_file
  err_file="$(mktemp)"

  while [ "$attempt" -le "$max" ]; do
    if aws ec2 delete-security-group \
         --region "$AWS_REGION" \
         --group-id "$sg_id" >/dev/null 2>"$err_file"; then
      rm -f "$err_file"
      log_ok "Deleted ${sg_name} (${sg_id})"
      return 0
    fi

    if grep -q "DependencyViolation" "$err_file" 2>/dev/null; then
      log_warn "${sg_name} still has attached network interfaces (attempt ${attempt}/${max}) — retrying in 10s"
      sleep 10
      attempt=$(( attempt + 1 ))
    else
      cat "$err_file" >&2
      rm -f "$err_file"
      log_err "Failed to delete ${sg_name} (${sg_id})"
    fi
  done

  rm -f "$err_file"
  log_err "Gave up deleting ${sg_name} after ${max} attempts — check for leftover ENIs still attached to it"
}

# ── Args ────────────────────────────────────────────────────────
ASSUME_YES=false
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=true; shift ;;
    *) log_err "Unknown argument: $1 (usage: destroy.sh [-y|--yes])" ;;
  esac
done

echo -e "${RED}${BOLD}================================================${NC}"
echo -e "${RED}${BOLD}   SheryMeet → AWS Infrastructure TEARDOWN     ${NC}"
echo -e "${RED}${BOLD}================================================${NC}"

# ============================================================
# STEP 0: Preflight — required .env.deploy variables
# ============================================================
log_step 0 "Checking required .env.deploy variables"

REQUIRED_VARS=(
  AWS_REGION
  SHERYMEET_INSTANCE_NAME
  LIVEKIT_INSTANCE_NAME
  REDIS_INSTANCE_NAME
  SHERYMEET_SECURITY_GROUP_NAME
  LIVEKIT_SECURITY_GROUP_NAME
  REDIS_SECURITY_GROUP_NAME
)
MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  [ -z "${!VAR}" ] && MISSING+=("$VAR")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  log_err "Missing from .env.deploy: ${MISSING[*]}"
fi
log_ok "All required variables present (region: ${AWS_REGION})"


# ============================================================
# STEP 1: Discover what actually exists
# ============================================================
log_step 1 "Discovering resources"

SHERYMEET_IDS=$(run "Finding '${SHERYMEET_INSTANCE_NAME}' instances" find_instances "$SHERYMEET_INSTANCE_NAME")
LIVEKIT_IDS=$(run "Finding '${LIVEKIT_INSTANCE_NAME}' instances"   find_instances "$LIVEKIT_INSTANCE_NAME")
REDIS_IDS=$(run "Finding '${REDIS_INSTANCE_NAME}' instances"       find_instances "$REDIS_INSTANCE_NAME")

REDIS_SG=$(run "Finding '${REDIS_SECURITY_GROUP_NAME}'"         find_sg "$REDIS_SECURITY_GROUP_NAME")
LIVEKIT_SG=$(run "Finding '${LIVEKIT_SECURITY_GROUP_NAME}'"     find_sg "$LIVEKIT_SECURITY_GROUP_NAME")
SHERYMEET_SG=$(run "Finding '${SHERYMEET_SECURITY_GROUP_NAME}'" find_sg "$SHERYMEET_SECURITY_GROUP_NAME")

# Word-splitting is intentional here: --output text returns tab-separated IDs.
ALL_INSTANCE_IDS=$(echo $SHERYMEET_IDS $LIVEKIT_IDS $REDIS_IDS)

echo ""
echo -e "  ${BOLD}Instances to terminate:${NC}"
if [ -n "$ALL_INSTANCE_IDS" ]; then
  [ -n "$SHERYMEET_IDS" ] && echo -e "    ${CYAN}${SHERYMEET_INSTANCE_NAME}${NC}: ${SHERYMEET_IDS}"  || echo -e "    ${SHERYMEET_INSTANCE_NAME}: ${YELLOW}none${NC}"
  [ -n "$LIVEKIT_IDS" ]   && echo -e "    ${CYAN}${LIVEKIT_INSTANCE_NAME}${NC}: ${LIVEKIT_IDS}"      || echo -e "    ${LIVEKIT_INSTANCE_NAME}: ${YELLOW}none${NC}"
  [ -n "$REDIS_IDS" ]     && echo -e "    ${CYAN}${REDIS_INSTANCE_NAME}${NC}: ${REDIS_IDS}"          || echo -e "    ${REDIS_INSTANCE_NAME}: ${YELLOW}none${NC}"
else
  echo -e "    ${YELLOW}none${NC}"
fi

echo -e "  ${BOLD}Security groups to delete:${NC}"
[ "$REDIS_SG" != "None" ]     && echo -e "    ${CYAN}${REDIS_SECURITY_GROUP_NAME}${NC}: ${REDIS_SG}"         || echo -e "    ${REDIS_SECURITY_GROUP_NAME}: ${YELLOW}none${NC}"
[ "$LIVEKIT_SG" != "None" ]   && echo -e "    ${CYAN}${LIVEKIT_SECURITY_GROUP_NAME}${NC}: ${LIVEKIT_SG}"     || echo -e "    ${LIVEKIT_SECURITY_GROUP_NAME}: ${YELLOW}none${NC}"
[ "$SHERYMEET_SG" != "None" ] && echo -e "    ${CYAN}${SHERYMEET_SECURITY_GROUP_NAME}${NC}: ${SHERYMEET_SG}" || echo -e "    ${SHERYMEET_SECURITY_GROUP_NAME}: ${YELLOW}none${NC}"

if [ -z "$ALL_INSTANCE_IDS" ] && [ "$REDIS_SG" = "None" ] && [ "$LIVEKIT_SG" = "None" ] && [ "$SHERYMEET_SG" = "None" ]; then
  echo ""
  log_ok "Nothing to destroy — already clean."
  exit 0
fi


# ============================================================
# STEP 2: Confirm (this is irreversible)
# ============================================================
log_step 2 "Confirmation"

if [ "$ASSUME_YES" = true ]; then
  log_warn "--yes passed; skipping the confirmation prompt"
else
  # Refuse to run unattended without an explicit --yes: terminating
  # instances and deleting security groups cannot be undone.
  if [ ! -t 0 ]; then
    log_err "Not an interactive terminal and --yes was not passed. Refusing to destroy anything."
  fi
  echo ""
  echo -ne "  ${RED}${BOLD}This cannot be undone. Type 'destroy' to confirm: ${NC}"
  read -r CONFIRM
  [ "$CONFIRM" = "destroy" ] || log_err "Aborted — nothing was destroyed."
fi


# ============================================================
# STEP 3: Terminate instances
# ============================================================
log_step 3 "Terminating EC2 instances"

if [ -n "$ALL_INSTANCE_IDS" ]; then
  # Terminate everything in one call and wait once, rather than
  # terminate-then-wait per instance — EC2 termination takes a minute or
  # two each, and serialising the waits triples the teardown time.
  run "Terminating $(echo $ALL_INSTANCE_IDS | wc -w) instance(s)" \
    aws ec2 terminate-instances \
      --region "$AWS_REGION" \
      --instance-ids $ALL_INSTANCE_IDS >/dev/null

  run "Waiting for all instances to reach 'terminated'" \
    aws ec2 wait instance-terminated \
      --region "$AWS_REGION" \
      --instance-ids $ALL_INSTANCE_IDS >/dev/null

  log_ok "All instances terminated"
else
  log_warn "No instances found — skipping"
fi


# ============================================================
# STEP 4: Delete security groups
# ============================================================
log_step 4 "Deleting security groups"

# Order matters: the Redis group holds the ingress rules that *reference*
# the LiveKit and SheryMeet groups (csg.sh grants 6379 to both by group id).
# AWS refuses to delete a group while another group's rules point at it, so
# Redis has to go first to release those references.
if [ "$REDIS_SG" != "None" ] && [ -n "$REDIS_SG" ]; then
  delete_sg "$REDIS_SG" "$REDIS_SECURITY_GROUP_NAME"
else
  log_warn "${REDIS_SECURITY_GROUP_NAME} not found — skipping"
fi

if [ "$LIVEKIT_SG" != "None" ] && [ -n "$LIVEKIT_SG" ]; then
  delete_sg "$LIVEKIT_SG" "$LIVEKIT_SECURITY_GROUP_NAME"
else
  log_warn "${LIVEKIT_SECURITY_GROUP_NAME} not found — skipping"
fi

if [ "$SHERYMEET_SG" != "None" ] && [ -n "$SHERYMEET_SG" ]; then
  delete_sg "$SHERYMEET_SG" "$SHERYMEET_SECURITY_GROUP_NAME"
else
  log_warn "${SHERYMEET_SECURITY_GROUP_NAME} not found — skipping"
fi


# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ EC2 and security groups destroyed         ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  ${YELLOW}⚠${NC}  ${BOLD}Deliberately NOT destroyed${NC} — remove by hand if you want a full teardown:"
echo -e "     • IAM role ${CYAN}${IAM_ROLE_NAME:-<IAM_ROLE_NAME>}${NC} + instance profile ${CYAN}${IAM_PROFILE_NAME:-<IAM_PROFILE_NAME>}${NC} (created by sm.sh)"
echo -e "     • Secrets Manager secret (created by secrets.sh) — deleting it is"
echo -e "       irreversible after the recovery window, so it is left alone"
echo -e "     • ECR repository and pushed images (created by aws.ecr.sh)"
echo -e "     • The VPC/subnet — pre-existing, never created by these scripts"
echo ""

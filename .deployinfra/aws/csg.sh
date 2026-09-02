set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a
source <(tr -d '\r' < "$PROJECT_ROOT/.env.deploy")
set +a

# ── Color helpers (matches aws.ecr.sh) ────────────────────────
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
# Runs "$@" in the background with a braille spinner animating over
# its label until it exits, then prints ✔/✘. stdout of "$@" is
# captured and echoed on success, so call sites can still do
# VAR=$(run "label" some-command ...) exactly like a plain $(...).
#
# IMPORTANT: `run` itself is always invoked inside a $(...) capture, so
# *everything* it writes to its own stdout (fd 1) ends up in the caller's
# variable — not just the final `cat "$tmp_out"`. `tput` writes cursor
# show/hide escape codes to stdout by default; those must be redirected
# to the terminal (fd 2) explicitly with `>&2`, or they silently ride
# along inside the captured value (invisible in a terminal, but very much
# present — and enough to make AWS's XML-based API reject the value with
# "InvalidCharacter"). This bit us once already; don't remove the >&2.
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

echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}   SheryMeet → AWS Security Group Setup        ${NC}"
echo -e "${BOLD}================================================${NC}"

# ============================================================
# STEP 1: Resolve the default VPC
# ============================================================
log_step 1 "Resolving VPC '${AWS_VPC_NAME}'"

VPC_ID=$(run "Looking up VPC" \
  aws ec2 describe-vpcs \
    --region "$AWS_REGION" \
    --filters "Name=tag:Name,Values=$AWS_VPC_NAME" \
    --query "Vpcs[0].VpcId" \
    --output text)

[ "$VPC_ID" = "None" ] && log_err "No VPC found tagged Name=${AWS_VPC_NAME} in region ${AWS_REGION}"
log_ok "VPC: ${VPC_ID}"


# ============================================================
# STEP 2: Create the security groups
# ============================================================
log_step 2 "Creating security groups"

LIVEKIT_SG=$(run "Creating '${LIVEKIT_SECURITY_GROUP_NAME}'" \
  aws ec2 create-security-group \
    --region "$AWS_REGION" \
    --group-name "$LIVEKIT_SECURITY_GROUP_NAME" \
    --description "LiveKit Security Group" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" \
    --output text)
log_ok "LiveKit SG: ${LIVEKIT_SG}"

SHERYMEET_SG=$(run "Creating '${SHERYMEET_SECURITY_GROUP_NAME}'" \
  aws ec2 create-security-group \
    --region "$AWS_REGION" \
    --group-name "$SHERYMEET_SECURITY_GROUP_NAME" \
    --description "SheryMeet Security Group" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" \
    --output text)
log_ok "SheryMeet SG: ${SHERYMEET_SG}"

REDIS_SG=$(run "Creating '${REDIS_SECURITY_GROUP_NAME}'" \
  aws ec2 create-security-group \
    --region "$AWS_REGION" \
    --group-name "$REDIS_SECURITY_GROUP_NAME" \
    --description "Redis Security Group" \
    --vpc-id "$VPC_ID" \
    --query "GroupId" \
    --output text)
log_ok "Redis SG: ${REDIS_SG}"


# ============================================================
# STEP 3: Rules for livekit-security-group
# ============================================================
log_step 3 "Adding rules to '${LIVEKIT_SECURITY_GROUP_NAME}'"

for PORT in 22 80 443 3478 5349 7880 7881; do
  run "Allow TCP ${PORT}" \
    aws ec2 authorize-security-group-ingress \
      --region "$AWS_REGION" \
      --group-id "$LIVEKIT_SG" \
      --protocol tcp \
      --port "$PORT" \
      --cidr 0.0.0.0/0 >/dev/null
done

run "Allow UDP 50000-60000 (media)" \
  aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$LIVEKIT_SG" \
    --protocol udp \
    --port 50000-60000 \
    --cidr 0.0.0.0/0 >/dev/null


# ============================================================
# STEP 4: Rules for sherymeet-security-group
# ============================================================
log_step 4 "Adding rules to '${SHERYMEET_SECURITY_GROUP_NAME}'"

for PORT in 22 80 443; do
  run "Allow TCP ${PORT}" \
    aws ec2 authorize-security-group-ingress \
      --region "$AWS_REGION" \
      --group-id "$SHERYMEET_SG" \
      --protocol tcp \
      --port "$PORT" \
      --cidr 0.0.0.0/0 >/dev/null
done


# ============================================================
# STEP 5: Rules for redis-security-group
# ============================================================
log_step 5 "Adding rules to '${REDIS_SECURITY_GROUP_NAME}'"

run "Allow TCP 22 (SSH)" \
  aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$REDIS_SG" \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 >/dev/null

run "Allow TCP 6379 from LiveKit + SheryMeet SGs" \
  aws ec2 authorize-security-group-ingress \
    --region "$AWS_REGION" \
    --group-id "$REDIS_SG" \
    --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":6379,\"ToPort\":6379,\"UserIdGroupPairs\":[{\"GroupId\":\"$LIVEKIT_SG\"},{\"GroupId\":\"$SHERYMEET_SG\"}]}]" >/dev/null


# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ Security groups ready!                    ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}VPC:${NC}       ${CYAN}${VPC_ID}${NC}"
echo -e "  ${BOLD}LiveKit:${NC}   ${CYAN}${LIVEKIT_SG}${NC}"
echo -e "  ${BOLD}SheryMeet:${NC} ${CYAN}${SHERYMEET_SG}${NC}"
echo -e "  ${BOLD}Redis:${NC}     ${CYAN}${REDIS_SG}${NC}"
echo ""

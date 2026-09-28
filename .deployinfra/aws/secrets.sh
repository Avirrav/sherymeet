set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Color helpers (matches aws.ecr.sh / csg.sh / redisdeploy.sh / lk.sh) ─
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

echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}   SheryMeet → AWS Secrets Manager              ${NC}"
echo -e "${BOLD}================================================${NC}"

# ============================================================
# STEP 0: Parse args, load defaults, check prerequisites
# ============================================================
log_step 0 "Checking prerequisites"

ENV_FILE="$PROJECT_ROOT/.env"
SECRET_NAME="sherymeet/app"
REGION_OVERRIDE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --name)     SECRET_NAME="$2"; shift 2 ;;
    --region)   REGION_OVERRIDE="$2"; shift 2 ;;
    *) log_err "Unknown argument: $1" ;;
  esac
done

command -v aws >/dev/null 2>&1 || log_err "AWS CLI is not installed."
command -v jq  >/dev/null 2>&1 || log_err "jq is not installed (needed to build the secret JSON safely). Install: apt install -y jq / brew install jq"
[ -f "$ENV_FILE" ] || log_err "No env file at ${ENV_FILE}. Copy .env.example to .env (or pass --env-file) first."
log_ok "AWS CLI, jq, and ${ENV_FILE} all found"

# AWS_REGION comes from .env.deploy unless --region overrides it — this
# script's own secret payload comes from .env, never .env.deploy.
if [ -n "$REGION_OVERRIDE" ]; then
  AWS_REGION="$REGION_OVERRIDE"
elif [ -f "$PROJECT_ROOT/.env.deploy" ]; then
  ENV_TMP=$(mktemp)
  tr -d '\r' < "$PROJECT_ROOT/.env.deploy" > "$ENV_TMP"
  set -a
  source "$ENV_TMP"
  set +a
  rm -f "$ENV_TMP"
fi
[ -z "$AWS_REGION" ] && log_err "No region set. Pass --region, or set AWS_REGION in .env.deploy."
log_ok "Region: ${AWS_REGION}"


# ============================================================
# STEP 1: Build the secret JSON from every KEY=VALUE in .env
# ============================================================
log_step 1 "Reading '${ENV_FILE}'"

FIELD_COUNT=0
SECRET_JSON=$(
  tr -d '\r' < "$ENV_FILE" | while IFS= read -r LINE; do
    # Skip blank lines and comments.
    [[ -z "$LINE" || "$LINE" =~ ^[[:space:]]*# ]] && continue
    # Allow (and strip) a leading `export `.
    LINE="${LINE#export }"
    [[ "$LINE" != *=* ]] && continue

    KEY="${LINE%%=*}"
    VALUE="${LINE#*=}"
    KEY="$(echo -n "$KEY" | xargs)" # trim whitespace around the key
    [ -z "$KEY" ] && continue

    # Strip one layer of matching surrounding quotes, if present —
    # .env values are conventionally written "like this" or 'like this'.
    if [[ "$VALUE" == \"*\" && "${#VALUE}" -ge 2 ]]; then
      VALUE="${VALUE:1:${#VALUE}-2}"
    elif [[ "$VALUE" == \'*\' && "${#VALUE}" -ge 2 ]]; then
      VALUE="${VALUE:1:${#VALUE}-2}"
    fi

    jq -n --arg k "$KEY" --arg v "$VALUE" '{($k): $v}'
  done | jq -s 'add // {}'
)

FIELD_COUNT=$(echo "$SECRET_JSON" | jq 'length')
[ "$FIELD_COUNT" -eq 0 ] && log_err "No KEY=VALUE lines found in ${ENV_FILE}"
log_ok "Found ${FIELD_COUNT} field(s): $(echo "$SECRET_JSON" | jq -r 'keys | join(", ")')"


# ============================================================
# STEP 2: Create or update the secret
# ============================================================
log_step 2 "Publishing secret '${AWS_SECRET_MANAGER_NAME}'"

EXISTS=$(aws secretsmanager describe-secret \
  --region "$AWS_REGION" \
  --secret-id "$AWS_SECRET_MANAGER_NAME" >/dev/null 2>&1 && echo yes || echo no)

if [ "$EXISTS" = "yes" ]; then
  run "Updating existing secret" \
    aws secretsmanager put-secret-value \
      --region "$AWS_REGION" \
      --secret-id "$AWS_SECRET_MANAGER_NAME" \
      --secret-string "$SECRET_JSON" >/dev/null
  log_ok "Secret updated"
else
  run "Creating new secret" \
    aws secretsmanager create-secret \
      --region "$AWS_REGION" \
      --name "$AWS_SECRET_MANAGER_NAME" \
      --secret-string "$SECRET_JSON" >/dev/null
  log_ok "Secret created"
fi


# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ Secret published!                         ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}Name:${NC}    ${CYAN}${AWS_SECRET_MANAGER_NAME}${NC}"
echo -e "  ${BOLD}Region:${NC}  ${CYAN}${AWS_REGION}${NC}"
echo -e "  ${BOLD}Fields:${NC}  ${CYAN}${FIELD_COUNT}${NC}"
echo ""
echo -e "  ${BOLD}Fetch it later with:${NC}"
echo -e "  ${YELLOW}aws secretsmanager get-secret-value --region ${AWS_REGION} --secret-id ${AWS_SECRET_MANAGER_NAME} --query SecretString --output text${NC}"
echo ""

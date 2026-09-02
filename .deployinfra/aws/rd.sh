set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a
source <(tr -d '\r' < "$PROJECT_ROOT/.env.deploy")
set +a

# ── Color helpers (matches aws.ecr.sh / csg.sh) ────────────────
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
echo -e "${BOLD}   SheryMeet → AWS Redis Deployment            ${NC}"
echo -e "${BOLD}================================================${NC}"

# ============================================================
# STEP 1: Latest Ubuntu 24.04 AMI
# ============================================================
log_step 1 "Finding latest Ubuntu 24.04 AMI"

AMI_ID=$(run "Querying Canonical's AMI catalog" \
  aws ec2 describe-images \
    --region "$AWS_REGION" \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" "Name=state,Values=available" \
    --query "sort_by(Images,&CreationDate)[-1].ImageId" \
    --output text)

[ -z "$AMI_ID" ] || [ "$AMI_ID" = "None" ] && log_err "No Ubuntu 24.04 AMI found in region ${AWS_REGION}"
log_ok "AMI: ${AMI_ID}"


# ============================================================
# STEP 2: Resolve VPC + subnet
# ============================================================
log_step 2 "Resolving VPC '${AWS_VPC_NAME}' and a subnet"

VPC_ID=$(run "Looking up VPC" \
  aws ec2 describe-vpcs \
    --region "$AWS_REGION" \
    --filters "Name=tag:Name,Values=$AWS_VPC_NAME" \
    --query "Vpcs[0].VpcId" \
    --output text)
[ -z "$VPC_ID" ] || [ "$VPC_ID" = "None" ] && log_err "No VPC found tagged Name=${AWS_VPC_NAME} in region ${AWS_REGION}"
log_ok "VPC: ${VPC_ID}"

SUBNET_ID=$(run "Looking up a subnet in that VPC" \
  aws ec2 describe-subnets \
    --region "$AWS_REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query "Subnets[0].SubnetId" \
    --output text)
[ -z "$SUBNET_ID" ] || [ "$SUBNET_ID" = "None" ] && log_err "No subnet found in VPC ${VPC_ID}"
log_ok "Subnet: ${SUBNET_ID}"

REDIS_SG=$(run "Looking up '${REDIS_SECURITY_GROUP_NAME}'" \
  aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=group-name,Values=$REDIS_SECURITY_GROUP_NAME" \
    --query "SecurityGroups[0].GroupId" \
    --output text)
[ -z "$REDIS_SG" ] || [ "$REDIS_SG" = "None" ] && log_err "No security group named ${REDIS_SECURITY_GROUP_NAME} found (run csg.sh first?)"
log_ok "Redis SG: ${REDIS_SG}"


# ============================================================
# STEP 3: Build the instance's user-data (installs + runs Redis via Docker)
# ============================================================
log_step 3 "Preparing user-data"

USERDATA_FILE="redis_userdata.sh"
cat > redis_userdata.sh <<EOF
#!/bin/bash
apt update -y
curl -fsSL https://get.docker.com | sh

systemctl enable docker

systemctl start docker

docker volume create redis_data

docker run -d \\
  --name redis \\
  --restart unless-stopped \\
  -p 6379:6379 \\
  -v redis_data:/data \\
  redis:7 \\
  redis-server \\
  --bind 0.0.0.0 \\
  --appendonly yes \\
  --requirepass "${REDIS_PASSWORD}"

EOF
log_ok "User-data ready (${USERDATA_FILE})"


# ============================================================
# STEP 4: Launch the Redis EC2 instance
# ============================================================
log_step 4 "Launching Redis EC2 instance"

INSTANCE_ID=$(run "Requesting instance (${REDIS_INSTANCE_TYPE})" \
  aws ec2 run-instances \
    --region "$AWS_REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$REDIS_INSTANCE_TYPE" \
    --security-group-ids "$REDIS_SG" \
    --subnet-id "$SUBNET_ID" \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --associate-public-ip-address \
    --user-data file://redis_userdata.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$REDIS_INSTANCE_NAME}]" \
    --query "Instances[0].InstanceId" \
    --output text)
log_ok "Instance: ${INSTANCE_ID}"

rm -f "$USERDATA_FILE"

run "Waiting for instance to enter 'running' state" \
  aws ec2 wait instance-running \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" >/dev/null

PUBLIC_IP=$(run "Fetching public IP" \
  aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text)
log_ok "Public IP: ${PUBLIC_IP}"


# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ Redis deployed!                           ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}Instance:${NC}  ${CYAN}${INSTANCE_ID}${NC}"
echo -e "  ${BOLD}Public IP:${NC} ${CYAN}${PUBLIC_IP}${NC}"
echo -e "  ${BOLD}REDIS_URL:${NC} ${CYAN}redis://:${REDIS_PASSWORD}@${PUBLIC_IP}:6379${NC}"
echo ""
echo -e "  ${YELLOW}⚠${NC}  Docker is still installing/starting via cloud-init on first boot;"
echo -e "     give it a minute before connecting. Security group only allows"
echo -e "     port 6379 from the LiveKit and SheryMeet security groups — not"
echo -e "     the public internet — so this URL only works from those instances."
echo ""

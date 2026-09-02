set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

set -a

source <(tr -d '\r' < "$PROJECT_ROOT/.env.deploy")
set +a

SHERYMEET_SECRET_NAME="$SHERYMEET_SECRET_MANAGER_NAME"

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
echo -e "${BOLD}   SheryMeet → AWS App Deployment               ${NC}"
echo -e "${BOLD}================================================${NC}"

# ============================================================
# STEP 0: Preflight — required .env.deploy variables
# ============================================================
log_step 0 "Checking required .env.deploy variables"

REQUIRED_VARS=(
  AWS_ECR_IMAGE
  IAM_ROLE_NAME
  IAM_PROFILE_NAME
  SHERYMEET_SECURITY_GROUP_NAME
  SHERYMEET_INSTANCE_TYPE
  SHERYMEET_INSTANCE_NAME
)
MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  [ -z "${!VAR}" ] && MISSING+=("$VAR")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  log_err "Missing from .env.deploy: ${MISSING[*]}"
fi
log_ok "All required variables present"
log_ok "Runtime env will be pulled from Secrets Manager secret '${SHERYMEET_SECRET_NAME}' at boot"


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
# STEP 2: Resolve VPC + subnet + security group
# ============================================================
log_step 2 "Resolving VPC '${AWS_VPC_NAME}', a subnet, and the security group"

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

SHERYMEET_SG=$(run "Looking up '${SHERYMEET_SECURITY_GROUP_NAME}'" \
  aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=group-name,Values=$SHERYMEET_SECURITY_GROUP_NAME" \
    --query "SecurityGroups[0].GroupId" \
    --output text)
[ -z "$SHERYMEET_SG" ] || [ "$SHERYMEET_SG" = "None" ] && log_err "No security group named ${SHERYMEET_SECURITY_GROUP_NAME} found (run csg.sh first?)"
log_ok "SheryMeet SG: ${SHERYMEET_SG}"


# ============================================================
# STEP 3: IAM role + instance profile
# ============================================================
log_step 3 "Setting up IAM role '${IAM_ROLE_NAME}'"

ACCOUNT_ID=$(run "Resolving AWS account ID" \
  aws sts get-caller-identity --query Account --output text)

# The ARN of a Secrets Manager secret always carries a random 6-character
# suffix AWS appends at creation and never exposes as a separate field, so
# we scope the policy to "<name>*" rather than pinning the exact ARN.
SECRET_ARN_PREFIX="arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:${SHERYMEET_SECRET_NAME}"

if aws iam get-role --role-name "$IAM_ROLE_NAME" >/dev/null 2>&1; then
  log_ok "IAM role already exists"
else
  run "Creating IAM role" \
    aws iam create-role \
      --role-name "$IAM_ROLE_NAME" \
      --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
          {
            "Effect": "Allow",
            "Principal": { "Service": "ec2.amazonaws.com" },
            "Action": "sts:AssumeRole"
          }
        ]
      }' >/dev/null

  run "Attaching ECR read-only policy" \
    aws iam attach-role-policy \
      --role-name "$IAM_ROLE_NAME" \
      --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly >/dev/null

  # Least-privilege grant for the boot-time secret fetch: read-only, and
  # scoped to only the one secret this deployment uses — never a blanket
  # secretsmanager:* grant.
  run "Granting read access to secret '${SHERYMEET_SECRET_NAME}'" \
    aws iam put-role-policy \
      --role-name "$IAM_ROLE_NAME" \
      --policy-name "ReadSheryMeetSecret" \
      --policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [
          {
            \"Effect\": \"Allow\",
            \"Action\": [\"secretsmanager:GetSecretValue\"],
            \"Resource\": \"${SECRET_ARN_PREFIX}*\"
          }
        ]
      }" >/dev/null

  run "Creating instance profile" \
    aws iam create-instance-profile \
      --instance-profile-name "$IAM_PROFILE_NAME" >/dev/null

  run "Attaching role to instance profile" \
    aws iam add-role-to-instance-profile \
      --instance-profile-name "$IAM_PROFILE_NAME" \
      --role-name "$IAM_ROLE_NAME" >/dev/null

  run "Waiting for IAM propagation (~20s)" \
    sleep 20
  log_ok "IAM role, instance profile, and secret-read policy ready"
fi


# ============================================================
# STEP 4: Render cloud-init user-data
# ============================================================
log_step 4 "Rendering user-data"

USERDATA_FILE="sherymeet_userdata.sh"
cat > sherymeet_userdata.sh <<EOF
#!/bin/bash
set -e

apt update -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install AWS CLI + jq (jq turns the Secrets Manager JSON into a
# docker --env-file below).
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
apt install -y unzip jq
unzip -q awscliv2.zip
./aws/install

# Resolve our own account ID via this instance's IAM role, rather than
# baking a specific AWS account number into the script (which would
# silently break if this is ever deployed into a different account).
ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text)

# Login to ECR (same account/region this instance is deployed in).
aws ecr get-login-password --region "\$AWS_REGION" \\
  | docker login --username AWS --password-stdin "\${ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com"

mkdir -p /opt/sherymeet

# Pull the app's full runtime environment from Secrets Manager (published
# by .deployinfra/aws/secrets.sh from the repo's own .env) using this
# instance's IAM role. No plaintext secret ever touches this user-data
# script or EC2's console/API-visible instance metadata — only the
# secret's *name* does.
aws secretsmanager get-secret-value \\
  --region "\$AWS_REGION" \\
  --secret-id "\$SHERYMEET_SECRET_MANAGER_NAME" \\
  --query SecretString \\
  --output text \\
  | jq -r 'to_entries[] | "\(.key)=\(.value)"' > /opt/sherymeet/app.env

# Create Docker Network
docker network create sherymeet-network

# Pull Image
docker pull "\$AWS_ECR_IMAGE"

# Run SheryMeet Container — its entire runtime config comes from the
# Secrets Manager-sourced env file above. NODE_ENV is forced to
# production here since the source .env may reasonably be left at
# "development" for local dev.
docker run -d \\
  --name sherymeet \\
  --restart unless-stopped \\
  --network sherymeet-network \\
  -p 3000:3000 \\
  -e NODE_ENV=production \\
  --env-file /opt/sherymeet/app.env \\
  "\$AWS_ECR_IMAGE"

# Create Caddyfile
cat > /home/ubuntu/Caddyfile <<CADDY
$SHERYMEET_DOMAIN {
    reverse_proxy sherymeet:3000
}
CADDY

# Run Caddy Container
docker run -d \\
  --name caddy \\
  --restart unless-stopped \\
  --network sherymeet-network \\
  -p 80:80 \\
  -p 443:443 \\
  -v /home/ubuntu/Caddyfile:/etc/caddy/Caddyfile \\
  -v caddy_data:/data \\
  -v caddy_config:/config \\
  caddy:latest

EOF
log_ok "User-data ready (${USERDATA_FILE})"


# ============================================================
# STEP 5: Launch the SheryMeet EC2 instance
# ============================================================
log_step 5 "Launching SheryMeet EC2 instance"

SHERYMEET_INSTANCE_ID=$(run "Requesting instance (${SHERYMEET_INSTANCE_TYPE})" \
  aws ec2 run-instances \
    --region "$AWS_REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$SHERYMEET_INSTANCE_TYPE" \
    --security-group-ids "$SHERYMEET_SG" \
    --subnet-id "$SUBNET_ID" \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --associate-public-ip-address \
    --iam-instance-profile "Name=$IAM_PROFILE_NAME" \
    --user-data "file://sherymeet_userdata.sh" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$SHERYMEET_INSTANCE_NAME}]" \
    --query "Instances[0].InstanceId" \
    --output text)
log_ok "Instance: ${SHERYMEET_INSTANCE_ID}"

rm -f "$USERDATA_FILE"

run "Waiting for instance to enter 'running' state" \
  aws ec2 wait instance-running \
    --region "$AWS_REGION" \
    --instance-ids "$SHERYMEET_INSTANCE_ID" >/dev/null

SHERYMEET_PUBLIC_IP=$(run "Fetching public IP" \
  aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$SHERYMEET_INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text)
log_ok "Public IP: ${SHERYMEET_PUBLIC_IP}"


# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ SheryMeet deployed!                       ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}Instance:${NC}   ${CYAN}${SHERYMEET_INSTANCE_ID}${NC}"
echo -e "  ${BOLD}Public IP:${NC}  ${CYAN}${SHERYMEET_PUBLIC_IP}${NC}"
echo -e "  ${BOLD}Secret:${NC}     ${CYAN}${SHERYMEET_SECRET_NAME}${NC}"
echo -e "  ${BOLD}URL:${NC}        ${CYAN}http://${SHERYMEET_PUBLIC_IP}${NC}"
echo ""
echo -e "  ${YELLOW}⚠${NC}  cloud-init installs Docker/AWS CLI and fetches the secret on first"
echo -e "     boot — give it a minute before the app responds. The Caddyfile still"
echo -e "     hardcodes the 'lacoste.pugly.in' domain (unrelated to this change,"
echo -e "     left untouched — flag if that should be parameterized too)."
echo ""

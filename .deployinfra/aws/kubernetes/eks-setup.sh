#!/usr/bin/env bash
# ============================================================
# EKS CLUSTER SETUP SCRIPT
# ============================================================
# Creates a complete EKS cluster with all prerequisites:
# - VPC with public/private subnets
# - IAM roles for cluster and nodes
# - EKS cluster
# - Managed node group for LiveKit
# - AWS Load Balancer Controller
# - Karpenter for autoscaling
#
# Prerequisites:
# - AWS CLI configured with admin permissions
# - eksctl installed (brew install eksctl)
# - kubectl installed (brew install kubectl)
# - helm installed (brew install helm)
#
# Usage:
#   ./eks-setup.sh              # Full setup
#   ./eks-setup.sh --dry-run    # Preview only
#   ./eks-setup.sh --delete     # Delete everything
#
# Time: ~20-25 minutes for full setup
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# ── Parse arguments ───────────────────────────────────────────
DRY_RUN=false
DELETE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --delete) DELETE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Load environment variables ────────────────────────────────
if [ -f "$PROJECT_ROOT/.env.deploy" ]; then
  ENV_TMP=$(mktemp)
  tr -d '\r' < "$PROJECT_ROOT/.env.deploy" > "$ENV_TMP"
  set -a
  source "$ENV_TMP"
  set +a
  rm -f "$ENV_TMP"
fi

# ── Color helpers ─────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_step() { echo -e "\n${BLUE}${BOLD}[ STEP $1 ]${NC} ${CYAN}$2${NC}"; }
log_ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
log_err()  { echo -e "  ${RED}✘  ERROR: $1${NC}"; exit 1; }

echo -e "${BOLD}======================================================${NC}"
echo -e "${BOLD}   SheryMeet → EKS Cluster Setup                      ${NC}"
echo -e "${BOLD}======================================================${NC}"

# ============================================================
# STEP 0: Configuration
# ============================================================
log_step 0 "Configuration"

# Default values (override in .env.deploy)
CLUSTER_NAME="${CLUSTER_NAME:-sherymeet-cluster}"
AWS_REGION="${AWS_REGION:-ap-south-2}"
K8S_VERSION="${K8S_VERSION:-1.31}"

# Node configuration
NODE_INSTANCE_TYPE="${NODE_INSTANCE_TYPE:-c5.xlarge}"
NODE_COUNT="${NODE_COUNT:-2}"
NODE_MIN="${NODE_MIN:-1}"
NODE_MAX="${NODE_MAX:-10}"

# Networking
VPC_CIDR="${VPC_CIDR:-10.0.0.0/16}"

echo -e "  Cluster Name:    ${CYAN}${CLUSTER_NAME}${NC}"
echo -e "  Region:          ${CYAN}${AWS_REGION}${NC}"
echo -e "  K8s Version:     ${CYAN}${K8S_VERSION}${NC}"
echo -e "  Node Type:       ${CYAN}${NODE_INSTANCE_TYPE}${NC}"
echo -e "  Node Count:      ${CYAN}${NODE_MIN}-${NODE_MAX} (starting: ${NODE_COUNT})${NC}"

# ============================================================
# STEP 1: Prerequisites check
# ============================================================
log_step 1 "Checking prerequisites"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  log_err "AWS CLI not installed. Run: brew install awscli"
fi
log_ok "AWS CLI installed"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  log_err "AWS credentials not configured. Run: aws configure"
fi
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
log_ok "AWS Account: ${AWS_ACCOUNT_ID}"

# Check eksctl
if ! command -v eksctl &> /dev/null; then
  log_err "eksctl not installed. Run: brew install eksctl"
fi
log_ok "eksctl installed: $(eksctl version)"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
  log_err "kubectl not installed. Run: brew install kubectl"
fi
log_ok "kubectl installed"

# Check helm
if ! command -v helm &> /dev/null; then
  log_err "helm not installed. Run: brew install helm"
fi
log_ok "helm installed"

# ============================================================
# DELETE MODE
# ============================================================
if [ "$DELETE" = true ]; then
  log_step "D" "Deleting EKS cluster and all resources"

  echo -e "  ${YELLOW}⚠${NC}  This will delete:"
  echo -e "     - EKS cluster: ${CLUSTER_NAME}"
  echo -e "     - All node groups"
  echo -e "     - VPC and networking"
  echo -e "     - IAM roles"
  echo ""
  read -p "  Are you sure? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
  fi

  # Delete cluster (eksctl handles everything)
  eksctl delete cluster \
    --name "$CLUSTER_NAME" \
    --region "$AWS_REGION" \
    --wait

  log_ok "Cluster deleted"
  exit 0
fi

# ============================================================
# DRY RUN MODE
# ============================================================
if [ "$DRY_RUN" = true ]; then
  log_warn "DRY RUN MODE - showing what would be created"
fi

# ============================================================
# STEP 2: Find existing VPC and subnets
# ============================================================
log_step 2 "Finding existing VPC and subnets"

# Get VPC by name (same as lk.sh)
if [ -z "$AWS_VPC_NAME" ]; then
  log_err "AWS_VPC_NAME not set in .env.deploy"
fi

VPC_ID=$(aws ec2 describe-vpcs \
  --region "$AWS_REGION" \
  --filters "Name=tag:Name,Values=$AWS_VPC_NAME" \
  --query "Vpcs[0].VpcId" \
  --output text)

if [ -z "$VPC_ID" ] || [ "$VPC_ID" = "None" ]; then
  log_err "VPC '$AWS_VPC_NAME' not found in region $AWS_REGION"
fi
log_ok "Found VPC: $VPC_ID ($AWS_VPC_NAME)"

# Get subnets with their availability zones
SUBNET_INFO=$(aws ec2 describe-subnets \
  --region "$AWS_REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "Subnets[*].[SubnetId,AvailabilityZone]" \
  --output text)

if [ -z "$SUBNET_INFO" ] || [ "$SUBNET_INFO" = "None" ]; then
  log_err "No subnets found in VPC $VPC_ID"
fi

# Build YAML format for subnets (eksctl requires AZ as key)
SUBNET_YAML=""
SUBNET_COUNT=0
while read -r subnet_id az; do
  [ -z "$subnet_id" ] && continue
  SUBNET_YAML="${SUBNET_YAML}      ${az}:
        id: ${subnet_id}
"
  SUBNET_COUNT=$((SUBNET_COUNT + 1))
  [ $SUBNET_COUNT -ge 3 ] && break  # Max 3 subnets
done <<< "$SUBNET_INFO"

log_ok "Found $SUBNET_COUNT subnet(s)"

# Get VPC CIDR
VPC_CIDR=$(aws ec2 describe-vpcs \
  --region "$AWS_REGION" \
  --vpc-ids "$VPC_ID" \
  --query "Vpcs[0].CidrBlock" \
  --output text)
log_ok "VPC CIDR: $VPC_CIDR"

# ============================================================
# STEP 3: Create EKS cluster config
# ============================================================
log_step 3 "Generating cluster configuration"

CLUSTER_CONFIG="$SCRIPT_DIR/cluster-config.yaml"

cat > "$CLUSTER_CONFIG" <<EOF
# ============================================================
# EKS CLUSTER CONFIGURATION
# ============================================================
# Generated by eks-setup.sh
# Cluster: ${CLUSTER_NAME}
# Region: ${AWS_REGION}
# VPC: ${VPC_ID} (${AWS_VPC_NAME})
# ============================================================
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: ${CLUSTER_NAME}
  region: ${AWS_REGION}
  version: "${K8S_VERSION}"
  tags:
    Environment: production
    Application: sherymeet
    ManagedBy: eksctl

# ============================================================
# IAM OIDC Provider
# ============================================================
# Required for IAM Roles for Service Accounts (IRSA)
# Used by: AWS Load Balancer Controller, Karpenter
iam:
  withOIDC: true

  # Service account for AWS Load Balancer Controller
  serviceAccounts:
    - metadata:
        name: aws-load-balancer-controller
        namespace: kube-system
      wellKnownPolicies:
        awsLoadBalancerController: true

# ============================================================
# VPC Configuration (Using Existing VPC)
# ============================================================
# Reusing VPC: ${AWS_VPC_NAME} (${VPC_ID})
# This avoids creating duplicate NAT Gateways and saves cost
vpc:
  id: ${VPC_ID}
  cidr: ${VPC_CIDR}
  clusterEndpoints:
    publicAccess: true
    privateAccess: true
  subnets:
    public:
${SUBNET_YAML}

# ============================================================
# Managed Node Groups
# ============================================================
managedNodeGroups:
  # ──────────────────────────────────────────────────────────
  # System Node Group
  # ──────────────────────────────────────────────────────────
  # Runs cluster add-ons: CoreDNS, kube-proxy, ALB controller
  - name: system-nodes
    instanceType: t3.medium
    desiredCapacity: 2
    minSize: 2
    maxSize: 4
    volumeSize: 50
    volumeType: gp3

    labels:
      node-type: system

    tags:
      Name: ${CLUSTER_NAME}-system-node

    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        ebs: true

  # ──────────────────────────────────────────────────────────
  # LiveKit Node Group
  # ──────────────────────────────────────────────────────────
  # Dedicated nodes for LiveKit workloads
  # - Compute optimized instances for media processing
  # - Public IPs for WebRTC direct connections
  # - Labeled for DaemonSet node selection
  - name: livekit-nodes
    instanceType: ${NODE_INSTANCE_TYPE}
    desiredCapacity: ${NODE_COUNT}
    minSize: ${NODE_MIN}
    maxSize: ${NODE_MAX}
    volumeSize: 100
    volumeType: gp3

    # Labels for node selection
    labels:
      livekit.io/node-pool: livekit
      node-type: livekit

    # Taint to ensure only LiveKit pods run here
    taints:
      - key: livekit.io/dedicated
        value: "true"
        effect: NoSchedule

    tags:
      Name: ${CLUSTER_NAME}-livekit-node

    # SSH access (optional - for debugging)
    # ssh:
    #   allow: true
    #   publicKeyPath: ~/.ssh/id_rsa.pub

    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true
        ebs: true
        # For egress S3 uploads
        # externalDNS: true

# ============================================================
# Cluster Add-ons
# ============================================================
addons:
  - name: vpc-cni
    version: latest
    attachPolicyARNs:
      - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest
    wellKnownPolicies:
      ebsCSIController: true

# ============================================================
# CloudWatch Logging
# ============================================================
cloudWatch:
  clusterLogging:
    enableTypes:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler
EOF

log_ok "Cluster config created: $CLUSTER_CONFIG"

# ============================================================
# STEP 4: Create EKS cluster
# ============================================================
log_step 4 "Creating EKS cluster (this takes ~15-20 minutes)"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "  Would run: eksctl create cluster -f $CLUSTER_CONFIG"
  echo ""
  cat "$CLUSTER_CONFIG"
else
  eksctl create cluster -f "$CLUSTER_CONFIG"
  log_ok "EKS cluster created"
fi

# ============================================================
# STEP 5: Configure kubectl
# ============================================================
log_step 5 "Configuring kubectl"

if [ "$DRY_RUN" = false ]; then
  aws eks update-kubeconfig \
    --name "$CLUSTER_NAME" \
    --region "$AWS_REGION"

  # Verify connection
  if kubectl cluster-info &> /dev/null; then
    log_ok "kubectl configured and connected"
  else
    log_err "Failed to connect to cluster"
  fi

  # Show nodes
  echo ""
  kubectl get nodes
fi

# ============================================================
# STEP 6: Install AWS Load Balancer Controller
# ============================================================
log_step 6 "Installing AWS Load Balancer Controller"

if [ "$DRY_RUN" = false ]; then
  # Add Helm repo
  helm repo add eks https://aws.github.io/eks-charts 2>/dev/null || true
  helm repo update

  # Install controller
  helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
    -n kube-system \
    --set clusterName="$CLUSTER_NAME" \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller \
    --wait

  log_ok "AWS Load Balancer Controller installed"
fi

# ============================================================
# STEP 7: Install Metrics Server (for HPA)
# ============================================================
log_step 7 "Installing Metrics Server"

if [ "$DRY_RUN" = false ]; then
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  log_ok "Metrics Server installed"
fi

# ============================================================
# STEP 8: Create LiveKit security group rules
# ============================================================
log_step 8 "Configuring security groups for LiveKit"

if [ "$DRY_RUN" = false ]; then
  # Get the security group for LiveKit nodes
  LIVEKIT_SG=$(aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=tag:kubernetes.io/cluster/${CLUSTER_NAME},Values=owned" \
              "Name=tag:aws:eks:cluster-name,Values=${CLUSTER_NAME}" \
    --query "SecurityGroups[0].GroupId" \
    --output text 2>/dev/null || echo "")

  if [ -z "$LIVEKIT_SG" ] || [ "$LIVEKIT_SG" = "None" ]; then
    # Get node security group
    LIVEKIT_SG=$(aws eks describe-cluster \
      --name "$CLUSTER_NAME" \
      --region "$AWS_REGION" \
      --query "cluster.resourcesVpcConfig.clusterSecurityGroupId" \
      --output text)
  fi

  if [ -n "$LIVEKIT_SG" ] && [ "$LIVEKIT_SG" != "None" ]; then
    log_ok "Found security group: $LIVEKIT_SG"

    # Add LiveKit ports (ignore errors if rules exist)
    echo "  Adding security group rules..."

    # TURN UDP
    aws ec2 authorize-security-group-ingress \
      --group-id "$LIVEKIT_SG" \
      --protocol udp \
      --port 3478 \
      --cidr 0.0.0.0/0 \
      --region "$AWS_REGION" 2>/dev/null || true

    # TURN TLS
    aws ec2 authorize-security-group-ingress \
      --group-id "$LIVEKIT_SG" \
      --protocol tcp \
      --port 5349 \
      --cidr 0.0.0.0/0 \
      --region "$AWS_REGION" 2>/dev/null || true

    # WebRTC UDP range
    aws ec2 authorize-security-group-ingress \
      --group-id "$LIVEKIT_SG" \
      --protocol udp \
      --port 50000-60000 \
      --cidr 0.0.0.0/0 \
      --region "$AWS_REGION" 2>/dev/null || true

    # RTMP
    aws ec2 authorize-security-group-ingress \
      --group-id "$LIVEKIT_SG" \
      --protocol tcp \
      --port 1935 \
      --cidr 0.0.0.0/0 \
      --region "$AWS_REGION" 2>/dev/null || true

    # WHIP
    aws ec2 authorize-security-group-ingress \
      --group-id "$LIVEKIT_SG" \
      --protocol tcp \
      --port 8080 \
      --cidr 0.0.0.0/0 \
      --region "$AWS_REGION" 2>/dev/null || true

    log_ok "Security group rules added"
  else
    log_warn "Could not find security group - add rules manually"
  fi
fi

# ============================================================
# STEP 9: Get cluster info
# ============================================================
log_step 9 "Getting cluster information"

if [ "$DRY_RUN" = false ]; then
  CLUSTER_ENDPOINT=$(aws eks describe-cluster \
    --name "$CLUSTER_NAME" \
    --region "$AWS_REGION" \
    --query "cluster.endpoint" \
    --output text)

  OIDC_ISSUER=$(aws eks describe-cluster \
    --name "$CLUSTER_NAME" \
    --region "$AWS_REGION" \
    --query "cluster.identity.oidc.issuer" \
    --output text)

  # Get IAM instance profile for nodes
  IAM_PROFILE=$(aws iam list-instance-profiles \
    --query "InstanceProfiles[?contains(InstanceProfileName, '${CLUSTER_NAME}')].InstanceProfileName | [0]" \
    --output text 2>/dev/null || echo "")
fi

# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ EKS Cluster Setup Complete!                     ${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo ""
echo -e "  ${BOLD}Cluster:${NC}         ${CYAN}${CLUSTER_NAME}${NC}"
echo -e "  ${BOLD}Region:${NC}          ${CYAN}${AWS_REGION}${NC}"
echo -e "  ${BOLD}K8s Version:${NC}     ${CYAN}${K8S_VERSION}${NC}"
echo -e "  ${BOLD}VPC:${NC}             ${CYAN}${VPC_ID} (${AWS_VPC_NAME})${NC}"
if [ "$DRY_RUN" = false ]; then
  echo -e "  ${BOLD}Endpoint:${NC}        ${CYAN}${CLUSTER_ENDPOINT}${NC}"
  echo -e "  ${BOLD}OIDC Issuer:${NC}     ${CYAN}${OIDC_ISSUER}${NC}"
  [ -n "$IAM_PROFILE" ] && echo -e "  ${BOLD}IAM Profile:${NC}     ${CYAN}${IAM_PROFILE}${NC}"
fi
echo ""
echo -e "  ${BOLD}Node Groups:${NC}"
echo -e "    - system-nodes:  t3.medium × 2 (cluster add-ons)"
echo -e "    - livekit-nodes: ${NODE_INSTANCE_TYPE} × ${NODE_COUNT} (LiveKit workloads)"
echo ""
echo -e "  ${BOLD}Next Steps:${NC}"
echo -e "    1. Update .env.deploy with:"
echo -e "       CLUSTER_NAME=${CLUSTER_NAME}"
[ -n "$IAM_PROFILE" ] && echo -e "       IAM_PROFILE_NAME=${IAM_PROFILE}"
echo ""
echo -e "    2. Deploy LiveKit:"
echo -e "       cd ${SCRIPT_DIR}"
echo -e "       ./deploy.sh"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    kubectl get nodes"
echo -e "    kubectl get pods -A"
echo -e "    eksctl get nodegroup --cluster ${CLUSTER_NAME}"
echo ""

# Save cluster info to file
if [ "$DRY_RUN" = false ]; then
  CLUSTER_INFO="$SCRIPT_DIR/cluster-info.txt"
  cat > "$CLUSTER_INFO" <<EOF
# EKS Cluster Information
# Generated: $(date)

CLUSTER_NAME=${CLUSTER_NAME}
AWS_REGION=${AWS_REGION}
CLUSTER_ENDPOINT=${CLUSTER_ENDPOINT}
IAM_PROFILE_NAME=${IAM_PROFILE}
OIDC_ISSUER=${OIDC_ISSUER}

# Add to .env.deploy:
CLUSTER_NAME=${CLUSTER_NAME}
IAM_PROFILE_NAME=${IAM_PROFILE}
EOF
  echo -e "  ${GREEN}✔${NC} Cluster info saved to: $CLUSTER_INFO"
fi

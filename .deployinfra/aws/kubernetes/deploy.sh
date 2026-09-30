#!/usr/bin/env bash
# ============================================================
# LIVEKIT KUBERNETES DEPLOYMENT SCRIPT
# ============================================================
# Deploys LiveKit to an existing EKS cluster with all required
# components: Redis, LiveKit server, Egress, Ingress, and
# load balancers.
#
# Prerequisites:
# - AWS CLI configured with appropriate permissions
# - kubectl configured to target your EKS cluster
# - Helm 3.x installed
# - eksctl installed (for managed node groups)
# - .env.deploy file with required variables
#
# Usage:
#   ./deploy.sh              # Full deployment
#   ./deploy.sh --dry-run    # Preview changes only
#   ./deploy.sh --delete     # Remove all resources
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
ENV_TMP=$(mktemp)
tr -d '\r' < "$PROJECT_ROOT/.env.deploy" > "$ENV_TMP"
set -a
source "$ENV_TMP"
set +a
rm -f "$ENV_TMP"

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
echo -e "${BOLD}   SheryMeet → Kubernetes LiveKit Deployment          ${NC}"
echo -e "${BOLD}======================================================${NC}"

# ============================================================
# STEP 0: Preflight checks
# ============================================================
log_step 0 "Preflight checks"

# Required variables
REQUIRED_VARS=(
  CLUSTER_NAME
  AWS_REGION
  LIVEKIT_DOMAIN
  LIVEKIT_TURN_DOMAIN
  LIVEKIT_WHIP_DOMAIN
  LIVEKIT_WEBHOOK_DOMAIN
  IAM_PROFILE_NAME
)

MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  [ -z "${!VAR}" ] && MISSING+=("$VAR")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  log_err "Missing from .env.deploy: ${MISSING[*]}"
fi
log_ok "All required variables present"

# Check kubectl connectivity
if ! kubectl cluster-info &>/dev/null; then
  log_err "Cannot connect to Kubernetes cluster. Check your kubeconfig."
fi
log_ok "kubectl connected to cluster"

# Check cluster name matches
CURRENT_CLUSTER=$(kubectl config current-context | grep -oP '(?<=cluster/).*' || kubectl config current-context)
log_ok "Target cluster: $CURRENT_CLUSTER"

# ============================================================
# DELETE MODE
# ============================================================
if [ "$DELETE" = true ]; then
  log_step "D" "Deleting all LiveKit resources"

  kubectl delete namespace livekit --ignore-not-found=true

  log_ok "LiveKit namespace deleted"
  echo -e "\n${GREEN}${BOLD}Cleanup complete!${NC}"
  exit 0
fi

# ============================================================
# STEP 1: Generate secrets
# ============================================================
log_step 1 "Generating API keys and secrets"

# Generate if not set
if [ -z "$LIVEKIT_API_KEY" ]; then
  LIVEKIT_API_KEY=$(openssl rand -hex 8)
  log_ok "Generated LIVEKIT_API_KEY: $LIVEKIT_API_KEY"
else
  log_ok "Using existing LIVEKIT_API_KEY"
fi

if [ -z "$LIVEKIT_API_SECRET" ]; then
  LIVEKIT_API_SECRET=$(openssl rand -hex 32)
  log_ok "Generated LIVEKIT_API_SECRET"
else
  log_ok "Using existing LIVEKIT_API_SECRET"
fi

if [ -z "$REDIS_PASSWORD" ]; then
  REDIS_PASSWORD=$(openssl rand -hex 16)
  log_ok "Generated REDIS_PASSWORD"
else
  log_ok "Using existing REDIS_PASSWORD"
fi

# ============================================================
# STEP 2: Process templates
# ============================================================
log_step 2 "Processing Kubernetes manifests"

DEPLOY_DIR="$SCRIPT_DIR/rendered"
mkdir -p "$DEPLOY_DIR"

# Find ACM certificate ARN if not set
if [ -z "$ACM_CERTIFICATE_ARN" ]; then
  log_warn "ACM_CERTIFICATE_ARN not set - looking up certificate for $LIVEKIT_DOMAIN"
  ACM_CERTIFICATE_ARN=$(aws acm list-certificates \
    --region "$AWS_REGION" \
    --query "CertificateSummaryList[?DomainName=='$LIVEKIT_DOMAIN' || DomainName=='*$(echo $LIVEKIT_DOMAIN | sed 's/^[^.]*//').com'].CertificateArn | [0]" \
    --output text 2>/dev/null || echo "")

  if [ -z "$ACM_CERTIFICATE_ARN" ] || [ "$ACM_CERTIFICATE_ARN" = "None" ]; then
    log_warn "No ACM certificate found - ALB will not have TLS termination"
    ACM_CERTIFICATE_ARN="arn:aws:acm:${AWS_REGION}:ACCOUNT:certificate/PLACEHOLDER"
  else
    log_ok "Found ACM certificate: $ACM_CERTIFICATE_ARN"
  fi
fi

# Compute config checksum for rolling updates
CONFIG_CHECKSUM=$(cat "$SCRIPT_DIR/02-configmap.yaml" | sha256sum | cut -c1-8)

# Process each manifest file
for file in "$SCRIPT_DIR"/*.yaml; do
  [ -f "$file" ] || continue
  filename=$(basename "$file")

  # Skip if not a manifest file
  [[ "$filename" == "rendered"* ]] && continue

  # Replace variables
  sed -e "s|\${LIVEKIT_DOMAIN}|$LIVEKIT_DOMAIN|g" \
      -e "s|\${LIVEKIT_TURN_DOMAIN}|$LIVEKIT_TURN_DOMAIN|g" \
      -e "s|\${LIVEKIT_WHIP_DOMAIN}|$LIVEKIT_WHIP_DOMAIN|g" \
      -e "s|\${LIVEKIT_WEBHOOK_DOMAIN}|$LIVEKIT_WEBHOOK_DOMAIN|g" \
      -e "s|\${LIVEKIT_API_KEY}|$LIVEKIT_API_KEY|g" \
      -e "s|\${LIVEKIT_API_SECRET}|$LIVEKIT_API_SECRET|g" \
      -e "s|\${REDIS_PASSWORD}|$REDIS_PASSWORD|g" \
      -e "s|\${CLUSTER_NAME}|$CLUSTER_NAME|g" \
      -e "s|\${IAM_PROFILE_NAME}|$IAM_PROFILE_NAME|g" \
      -e "s|\${ACM_CERTIFICATE_ARN}|$ACM_CERTIFICATE_ARN|g" \
      -e "s|\${CONFIG_CHECKSUM}|$CONFIG_CHECKSUM|g" \
      -e "s|\${AWS_REGION}|$AWS_REGION|g" \
      "$file" > "$DEPLOY_DIR/$filename"

  log_ok "Processed: $filename"
done

# ============================================================
# STEP 3: Ensure EKS cluster has required add-ons
# ============================================================
log_step 3 "Checking cluster add-ons"

# Check for AWS Load Balancer Controller
if kubectl get deployment -n kube-system aws-load-balancer-controller &>/dev/null; then
  log_ok "AWS Load Balancer Controller is installed"
else
  log_warn "AWS Load Balancer Controller not found - installing via Helm"
  if [ "$DRY_RUN" = false ]; then
    helm repo add eks https://aws.github.io/eks-charts 2>/dev/null || true
    helm repo update
    helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
      -n kube-system \
      --set clusterName="$CLUSTER_NAME" \
      --set serviceAccount.create=true \
      --set serviceAccount.name=aws-load-balancer-controller
    log_ok "AWS Load Balancer Controller installed"
  fi
fi

# ============================================================
# STEP 4: Create LiveKit node group (optional)
# ============================================================
log_step 4 "Checking LiveKit node group"

NODE_GROUP_EXISTS=$(aws eks list-nodegroups \
  --cluster-name "$CLUSTER_NAME" \
  --region "$AWS_REGION" \
  --query "nodegroups[?contains(@, 'livekit')]" \
  --output text 2>/dev/null || echo "")

if [ -n "$NODE_GROUP_EXISTS" ]; then
  log_ok "LiveKit node group exists: $NODE_GROUP_EXISTS"
else
  log_warn "No LiveKit node group found"
  echo -e "  ${YELLOW}Create one with:${NC}"
  echo -e "  eksctl create nodegroup \\"
  echo -e "    --cluster $CLUSTER_NAME \\"
  echo -e "    --name livekit-nodes \\"
  echo -e "    --node-type c5.xlarge \\"
  echo -e "    --nodes 2 \\"
  echo -e "    --nodes-min 1 \\"
  echo -e "    --nodes-max 10 \\"
  echo -e "    --node-labels livekit.io/node-pool=livekit \\"
  echo -e "    --asg-access"
fi

# ============================================================
# STEP 5: Apply manifests
# ============================================================
log_step 5 "Applying Kubernetes manifests"

KUBECTL_ARGS=""
if [ "$DRY_RUN" = true ]; then
  KUBECTL_ARGS="--dry-run=client"
  log_warn "DRY RUN MODE - no changes will be made"
fi

# Apply in order
for file in "$DEPLOY_DIR"/*.yaml; do
  [ -f "$file" ] || continue
  filename=$(basename "$file")

  if kubectl apply -f "$file" $KUBECTL_ARGS 2>&1; then
    log_ok "Applied: $filename"
  else
    log_warn "Failed: $filename (may require CRDs or dependencies)"
  fi
done

# ============================================================
# STEP 6: Wait for deployment
# ============================================================
if [ "$DRY_RUN" = false ]; then
  log_step 6 "Waiting for deployments to be ready"

  echo "  Waiting for Redis..."
  kubectl rollout status deployment/redis -n livekit --timeout=120s || log_warn "Redis not ready"

  echo "  Waiting for LiveKit server..."
  kubectl rollout status daemonset/livekit-server -n livekit --timeout=300s || log_warn "LiveKit not ready"

  echo "  Waiting for Egress..."
  kubectl rollout status deployment/egress -n livekit --timeout=120s || log_warn "Egress not ready"
fi

# ============================================================
# STEP 7: Get load balancer endpoints
# ============================================================
log_step 7 "Getting load balancer endpoints"

if [ "$DRY_RUN" = false ]; then
  echo "  Waiting for ALB provisioning (this can take 2-3 minutes)..."
  sleep 30

  ALB_DNS=$(kubectl get ingress livekit-alb -n livekit \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")

  NLB_DNS=$(kubectl get service livekit-nlb -n livekit \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")
fi

# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ LiveKit Kubernetes Deployment Complete!         ${NC}"
echo -e "${GREEN}${BOLD}======================================================${NC}"
echo ""
echo -e "  ${BOLD}Namespace:${NC}         ${CYAN}livekit${NC}"
echo ""
echo -e "  ${BOLD}Domains:${NC}"
echo -e "    LiveKit:       ${CYAN}${LIVEKIT_DOMAIN}${NC}"
echo -e "    TURN:          ${CYAN}${LIVEKIT_TURN_DOMAIN}${NC}"
echo -e "    WHIP:          ${CYAN}${LIVEKIT_WHIP_DOMAIN}${NC}"
echo -e "    Webhook:       ${CYAN}${LIVEKIT_WEBHOOK_DOMAIN}${NC}"
echo ""
echo -e "  ${BOLD}Credentials:${NC}"
echo -e "    LIVEKIT_URL:        ${CYAN}wss://${LIVEKIT_DOMAIN}${NC}"
echo -e "    LIVEKIT_API_KEY:    ${CYAN}${LIVEKIT_API_KEY}${NC}"
echo -e "    LIVEKIT_API_SECRET: ${CYAN}${LIVEKIT_API_SECRET}${NC}"
echo ""
if [ "$DRY_RUN" = false ]; then
  echo -e "  ${BOLD}Load Balancers:${NC}"
  echo -e "    ALB (HTTP/WS):  ${CYAN}${ALB_DNS}${NC}"
  echo -e "    NLB (UDP/TURN): ${CYAN}${NLB_DNS}${NC}"
  echo ""
  echo -e "  ${YELLOW}⚠${NC}  DNS Setup Required:"
  echo -e "     Point ${LIVEKIT_DOMAIN} and ${LIVEKIT_WHIP_DOMAIN}"
  echo -e "     to the ALB: ${ALB_DNS}"
  echo ""
  echo -e "     Point ${LIVEKIT_TURN_DOMAIN}"
  echo -e "     to the NLB: ${NLB_DNS}"
fi
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "    kubectl get pods -n livekit"
echo -e "    kubectl logs -n livekit -l app.kubernetes.io/name=livekit"
echo -e "    kubectl get hpa -n livekit"
echo ""

# Save credentials to file for reference
CREDS_FILE="$DEPLOY_DIR/credentials.txt"
cat > "$CREDS_FILE" <<EOF
# LiveKit Kubernetes Deployment Credentials
# Generated: $(date)
# Cluster: $CLUSTER_NAME

LIVEKIT_URL=wss://${LIVEKIT_DOMAIN}
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
REDIS_PASSWORD=${REDIS_PASSWORD}
EOF
echo -e "  ${GREEN}✔${NC} Credentials saved to: $CREDS_FILE"

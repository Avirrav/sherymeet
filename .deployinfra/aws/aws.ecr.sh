#!/bin/bash

# ============================================================
#  SheryMeet — AWS ECR Image Push Script
#  Run this script from the project root:
#    bash pushImage.sh
# ============================================================

# ── Color helpers (makes output readable) ────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color (reset)

# ── Helper functions ─────────────────────────────────────────
log_step() { echo -e "\n${BLUE}${BOLD}[ STEP $1 ]${NC} ${CYAN}$2${NC}"; }
log_ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
log_err()  { echo -e "  ${RED}✘  ERROR: $1${NC}"; exit 1; }

# ── Exit immediately if any command fails ────────────────────
set -e

echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}   SheryMeet → AWS ECR Deployment Script       ${NC}"
echo -e "${BOLD}================================================${NC}"

# ============================================================
# ── CONFIGURATION — Edit these values ────────────────────────
# ============================================================
AWS_REGION="ap-south-1"           # Your AWS region
REPO_NAME="sherymeet-app"         # ECR repository name
IMAGE_TAG="latest"                # Docker image tag
# ─────────────────────────────────────────────────────────────
# AWS_ACCOUNT_ID is fetched automatically below (no need to set)
# ============================================================


# ============================================================
# STEP 1: Check prerequisites
# ============================================================
log_step 1 "Checking prerequisites (AWS CLI + Docker)"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  log_err "AWS CLI is not installed.\n  Install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
fi
log_ok "AWS CLI found: $(aws --version 2>&1 | head -n1)"

# Check Docker
if ! command -v docker &> /dev/null; then
  log_err "Docker is not installed or not in PATH."
fi
if ! docker info &> /dev/null; then
  log_err "Docker daemon is not running. Please start Docker Desktop."
fi
log_ok "Docker is running: $(docker --version)"

# Check AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
  log_err "AWS credentials not configured.\n  Run: aws configure\n  You need: Access Key ID, Secret Access Key, Region"
fi
log_ok "AWS credentials are valid"


# ============================================================
# STEP 2: Fetch AWS Account ID automatically
# ============================================================
log_step 2 "Fetching AWS Account ID"

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
log_ok "Account ID: ${AWS_ACCOUNT_ID}"

# Build the full ECR URI
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPO_NAME}"
log_ok "ECR URI will be: ${ECR_URI}:${IMAGE_TAG}"


# ============================================================
# STEP 3: Create ECR repository (if it doesn't already exist)
# ============================================================
log_step 3 "Ensuring ECR repository '${REPO_NAME}' exists"

# Check if repository already exists
if aws ecr describe-repositories --repository-names "${REPO_NAME}" --region "${AWS_REGION}" &> /dev/null; then
  log_warn "Repository '${REPO_NAME}' already exists — skipping creation"
else
  echo "  Creating repository..."
  aws ecr create-repository \
    --repository-name "${REPO_NAME}" \
    --region "${AWS_REGION}" \
    --image-scanning-configuration scanOnPush=true \
    --output table
  log_ok "Repository '${REPO_NAME}' created successfully"
fi


# ============================================================
# STEP 4: Authenticate Docker with AWS ECR
# ============================================================
# Concept: ECR uses temporary tokens (valid 12 hours).
# get-login-password fetches the token and pipes it directly
# to docker login — no manual password needed.
log_step 4 "Authenticating Docker with AWS ECR"

aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login \
    --username AWS \
    --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

log_ok "Docker authenticated with ECR"


# ============================================================
# STEP 5: Build the Docker image
# ============================================================
# Concept: docker compose build reads the Dockerfile and
# builds the image using the 3-stage pipeline we created.
# NEXT_PUBLIC_ vars must be passed at build time (baked into JS bundle).
log_step 5 "Building Docker image (this may take a few minutes)"

# Load ONLY NEXT_PUBLIC_ vars from .env for the Docker build args.
#
# ⚠️  WHY NOT export everything from .env?
#     .env contains AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY which may
#     belong to a DIFFERENT AWS account than the one configured via
#     `aws configure`. Exporting them would silently switch the AWS CLI
#     identity mid-script, causing later steps (describe-images, etc.)
#     to query the wrong account and fail with RepositoryNotFoundException.
#
#     Rule: AWS credentials always come from `aws configure` or IAM role.
#           .env is only read for NEXT_PUBLIC_ build-time variables.
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    # Only export NEXT_PUBLIC_ variables (needed by Next.js at build time)
    if [[ "$key" == NEXT_PUBLIC_* ]]; then
      export "$key=$value"
    fi
  done < .env
  log_ok "Loaded NEXT_PUBLIC_ build variables from .env"
  log_ok "AWS credentials unchanged (using aws configure / IAM role)"
else
  log_warn ".env file not found — NEXT_PUBLIC_ vars may be empty in the build"
fi

docker compose build --no-cache
log_ok "Docker image built successfully"


# ============================================================
# STEP 6: Tag the image for ECR
# ============================================================
# Concept: Docker requires the image name to start with the
# registry hostname for push to work. `docker tag` creates
# an alias pointing to the same image layers — no copy is made.
log_step 6 "Tagging image for ECR"

docker tag "${REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
log_ok "Tagged: ${REPO_NAME}:${IMAGE_TAG} → ${ECR_URI}:${IMAGE_TAG}"

# Also tag with git commit hash for traceability (if git is available)
if command -v git &> /dev/null && git rev-parse --short HEAD &> /dev/null; then
  GIT_HASH=$(git rev-parse --short HEAD)
  docker tag "${REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${GIT_HASH}"
  log_ok "Also tagged with git hash: ${ECR_URI}:${GIT_HASH}"
fi


# ============================================================
# STEP 7: Push the image to ECR
# ============================================================
log_step 7 "Pushing image to AWS ECR"

docker push "${ECR_URI}:${IMAGE_TAG}"

# Push git hash tag too (if it was created)
if [ -n "${GIT_HASH}" ]; then
  docker push "${ECR_URI}:${GIT_HASH}"
  log_ok "Pushed git hash tag: ${GIT_HASH}"
fi

log_ok "Image pushed successfully!"


# ============================================================
# STEP 8: Verify the push
# ============================================================
log_step 8 "Verifying image in ECR"

echo ""
aws ecr describe-images \
  --repository-name "${REPO_NAME}"\
  --region "${AWS_REGION}"\
  --query 'imageDetails[*].{Tag:imageTags[0],Size:imageSizeInBytes,Pushed:imagePushedAt}' \
  --output table

# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ Successfully pushed to AWS ECR!           ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}Image URI:${NC}"
echo -e "  ${CYAN}${ECR_URI}:${IMAGE_TAG}${NC}"
echo ""
echo -e "  ${BOLD}Use this URI in your ECS Task Definition or EC2:${NC}"
echo -e "  ${YELLOW}docker pull ${ECR_URI}:${IMAGE_TAG}${NC}"
echo ""

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

# ── Color helpers (matches aws.ecr.sh / csg.sh / redisdeploy.sh) ─
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
# Runs "$@" in the background with a braille spinner animating over its
# label until it exits, then prints ✔/✘. stdout of "$@" is captured and
# echoed on success, so call sites can do VAR=$(run "label" cmd ...)
# exactly like a plain $(...).
#
# `run` is always invoked inside a $(...) capture, so *everything* it
# writes to its own stdout (fd 1) ends up in the caller's variable — not
# just the final `cat "$tmp_out"`. `tput` writes cursor show/hide escape
# codes to stdout by default; they must be redirected to the terminal
# (fd 2) with `>&2`, or they silently ride along inside the captured
# value (invisible in a terminal, but present — and enough to make AWS's
# XML-based API reject the value with "InvalidCharacter").
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
echo -e "${BOLD}   SheryMeet → AWS LiveKit Deployment           ${NC}"
echo -e "${BOLD}================================================${NC}"

# ============================================================
# STEP 0: Preflight — required vars this script needs but that
# aren't provisioned by csg.sh/redisdeploy.sh's .env.deploy entries
# ============================================================
log_step 0 "Checking required .env.deploy variables"

REQUIRED_VARS=(
  LIVEKIT_INSTANCE_TYPE
  LIVEKIT_INSTANCE_NAME
  LIVEKIT_DOMAIN
  LIVEKIT_TURN_DOMAIN
  LIVEKIT_WHIP_DOMAIN
  LIVEKIT_WEBHOOK_DOMAIN
)
MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  [ -z "${!VAR}" ] && MISSING+=("$VAR")
done
if [ ${#MISSING[@]} -gt 0 ]; then
  log_err "Missing from .env.deploy: ${MISSING[*]}"
fi
log_ok "All required variables present"


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


# ============================================================
# STEP 3: Find the Redis instance's private IP
# ============================================================
log_step 3 "Finding the Redis instance"

REDIS_INSTANCE_ID=$(run "Searching for '${REDIS_INSTANCE_NAME}'" \
  aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --filters "Name=tag:Name,Values=$REDIS_INSTANCE_NAME" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
    --query "Reservations[0].Instances[0].InstanceId" \
    --output text)
[ -z "$REDIS_INSTANCE_ID" ] || [ "$REDIS_INSTANCE_ID" = "None" ] && log_err "Redis instance '${REDIS_INSTANCE_NAME}' not found (run redisdeploy.sh first?)"
log_ok "Redis instance: ${REDIS_INSTANCE_ID}"

REDIS_PRIVATE_IP=$(run "Fetching its private IP" \
  aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$REDIS_INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PrivateIpAddress" \
    --output text)
log_ok "Redis private IP: ${REDIS_PRIVATE_IP}"


# ============================================================
# STEP 4: Generate LiveKit API keys
# ============================================================
log_step 4 "Generating LiveKit API keys"

LIVEKIT_API_KEY=$(openssl rand -hex 8)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
log_ok "API key: ${LIVEKIT_API_KEY}"
log_ok "API secret: (32 bytes, hidden until the final summary)"


# ============================================================
# STEP 5: Render cloud-init user-data
# ============================================================
log_step 5 "Rendering cloud-init user-data"

USERDATA_FILE="livekit_userdata.yaml"
cat > livekit_userdata.yaml <<EOF
#cloud-config

package_update: true
package_upgrade: all

packages:
  - docker.io
  - docker-compose-v2

bootcmd:
  - mkdir -p /opt/livekit/caddy_data
  - mkdir -p /usr/local/bin

write_files:

  - path: /opt/livekit/livekit.yaml
    content: |
      port: 7880
      bind_addresses:
          - ""
      rtc:
          tcp_port: 7881
          port_range_start: 50000
          port_range_end: 60000
          use_external_ip: true
          enable_loopback_candidate: false

      redis:
          address: ${REDIS_PRIVATE_IP}:6379
          username: ""
          password: ${REDIS_PASSWORD}
          db: 0
          use_tls: false
          sentinel_master_name: ""
          sentinel_username: ""
          sentinel_password: ""
          sentinel_addresses: []
          cluster_addresses: []
          max_redirects: null

      turn:
          enabled: true
          domain: ${LIVEKIT_TURN_DOMAIN}
          tls_port: 5349
          udp_port: 3478
          external_tls: true

      ingress:
          rtmp_base_url: rtmp://${LIVEKIT_DOMAIN}:1935/x
          whip_base_url: https://${LIVEKIT_WHIP_DOMAIN}/w

      keys:
          ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}

      webhook:
          api_key: ${LIVEKIT_API_KEY}
          urls:
              - https://${LIVEKIT_WEBHOOK_DOMAIN}/webhook


  - path: /opt/livekit/caddy.yaml
    content: |
      logging:
        logs:
          default:
            level: INFO

      storage:
        "module": "file_system"
        "root": "/data"

      apps:
        tls:
          certificates:
            automate:
              - ${LIVEKIT_DOMAIN}
              - ${LIVEKIT_TURN_DOMAIN}
              - ${LIVEKIT_WHIP_DOMAIN}

        layer4:
          servers:
            main:
              listen: [":443"]

              routes:
                - match:
                  - tls:
                      sni:
                        - "${LIVEKIT_TURN_DOMAIN}"
                  handle:
                    - handler: tls
                    - handler: proxy
                      upstreams:
                        - dial: ["localhost:5349"]

                - match:
                    - tls:
                        sni:
                          - "${LIVEKIT_DOMAIN}"
                  handle:
                    - handler: tls
                      connection_policies:
                        - alpn: ["http/1.1", "acme-tls/1"]
                    - handler: proxy
                      upstreams:
                        - dial: ["localhost:7880"]

                - match:
                    - tls:
                        sni:
                          - "${LIVEKIT_WHIP_DOMAIN}"
                  handle:
                    - handler: tls
                      connection_policies:
                        - alpn: ["http/1.1", "acme-tls/1"]
                    - handler: proxy
                      upstreams:
                        - dial: ["localhost:8080"]


  - path: /opt/livekit/update_ip.sh
    permissions: "0755"
    content: |
      #!/usr/bin/env bash

      ip=\$(ip addr show | grep "inet " | grep -v 127.0.0. | head -1 | cut -d" " -f6 | cut -d/ -f1)

      sed -i.orig -r "s/\\\"(.+)(\\:5349)/\\\"\\$ip\\2/" /opt/livekit/caddy.yaml


  - path: /opt/livekit/docker-compose.yaml
    content: |
      services:

        caddy:
          image: livekit/caddyl4
          command: run --config /etc/caddy.yaml --adapter yaml
          restart: unless-stopped
          network_mode: "host"
          volumes:
            - ./caddy.yaml:/etc/caddy.yaml
            - ./caddy_data:/data

        livekit:
          image: livekit/livekit-server:latest
          command: --config /etc/livekit.yaml
          restart: unless-stopped
          network_mode: "host"
          volumes:
            - ./livekit.yaml:/etc/livekit.yaml

        egress:
          image: livekit/egress:latest
          restart: unless-stopped
          environment:
            - EGRESS_CONFIG_FILE=/etc/egress.yaml
          network_mode: "host"
          volumes:
            - ./egress.yaml:/etc/egress.yaml
          cap_add:
            - CAP_SYS_ADMIN

        ingress:
          image: livekit/ingress:latest
          restart: unless-stopped
          environment:
            - INGRESS_CONFIG_FILE=/etc/ingress.yaml
          network_mode: "host"
          volumes:
            - ./ingress.yaml:/etc/ingress.yaml
          cap_add:
            - CAP_SYS_ADMIN


  - path: /etc/systemd/system/livekit-docker.service
    content: |
      [Unit]
      Description=LiveKit Server Container
      After=docker.service
      Requires=docker.service

      [Service]
      LimitNOFILE=500000
      Restart=always
      WorkingDirectory=/opt/livekit

      ExecStartPre=-/usr/bin/docker compose -f docker-compose.yaml down
      ExecStart=/usr/bin/docker compose -f docker-compose.yaml up
      ExecStop=/usr/bin/docker compose -f docker-compose.yaml down

      [Install]
      WantedBy=multi-user.target


  - path: /opt/livekit/egress.yaml
    content: |
      redis:
          address: ${REDIS_PRIVATE_IP}:6379
          username: ""
          password: ${REDIS_PASSWORD}
          db: 0
          use_tls: false
          sentinel_master_name: ""
          sentinel_username: ""
          sentinel_password: ""
          sentinel_addresses: []
          cluster_addresses: []
          max_redirects: null

      api_key: ${LIVEKIT_API_KEY}
      api_secret: ${LIVEKIT_API_SECRET}
      ws_url: wss://${LIVEKIT_DOMAIN}


  - path: /opt/livekit/ingress.yaml
    content: |
      redis:
          address: ${REDIS_PRIVATE_IP}:6379
          username: ""
          password: ${REDIS_PASSWORD}
          db: 0
          use_tls: false
          sentinel_master_name: ""
          sentinel_username: ""
          sentinel_password: ""
          sentinel_addresses: []
          cluster_addresses: []
          max_redirects: null

      api_key: ${LIVEKIT_API_KEY}
      api_secret: ${LIVEKIT_API_SECRET}
      ws_url: wss://${LIVEKIT_DOMAIN}

      rtmp_port: 1935
      whip_port: 8080
      http_relay_port: 9090

      logging:
          json: false
          level: ""

      development: false

      rtc_config:
          udp_port: 7885
          use_external_ip: true
          enable_loopback_candidate: false


runcmd:
  - chmod 755 /opt/livekit/update_ip.sh
  - /opt/livekit/update_ip.sh
  - systemctl enable livekit-docker
  - systemctl start livekit-docker
EOF
log_ok "User-data ready (${USERDATA_FILE})"


# ============================================================
# STEP 6: Launch the LiveKit EC2 instance
# ============================================================
log_step 6 "Launching LiveKit EC2 instance"

LIVEKIT_SG=$(run "Looking up '${LIVEKIT_SECURITY_GROUP_NAME}'" \
  aws ec2 describe-security-groups \
    --region "$AWS_REGION" \
    --filters "Name=group-name,Values=$LIVEKIT_SECURITY_GROUP_NAME" \
    --query "SecurityGroups[0].GroupId" \
    --output text)
[ -z "$LIVEKIT_SG" ] || [ "$LIVEKIT_SG" = "None" ] && log_err "No security group named ${LIVEKIT_SECURITY_GROUP_NAME} found (run csg.sh first?)"
log_ok "LiveKit SG: ${LIVEKIT_SG}"

LIVEKIT_INSTANCE_ID=$(run "Requesting instance (${LIVEKIT_INSTANCE_TYPE})" \
  aws ec2 run-instances \
    --region "$AWS_REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$LIVEKIT_INSTANCE_TYPE" \
    --security-group-ids "$LIVEKIT_SG" \
    --subnet-id "$SUBNET_ID" \
    --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
    --associate-public-ip-address \
    --user-data "file://livekit_userdata.yaml" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$LIVEKIT_INSTANCE_NAME}]" \
    --query "Instances[0].InstanceId" \
    --output text)
log_ok "Instance: ${LIVEKIT_INSTANCE_ID}"

rm -f "$USERDATA_FILE"

run "Waiting for instance to enter 'running' state" \
  aws ec2 wait instance-running \
    --region "$AWS_REGION" \
    --instance-ids "$LIVEKIT_INSTANCE_ID" >/dev/null

LIVEKIT_PUBLIC_IP=$(run "Fetching public IP" \
  aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$LIVEKIT_INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text)

LIVEKIT_PRIVATE_IP=$(run "Fetching private IP" \
  aws ec2 describe-instances \
    --region "$AWS_REGION" \
    --instance-ids "$LIVEKIT_INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PrivateIpAddress" \
    --output text)
log_ok "Public IP: ${LIVEKIT_PUBLIC_IP}  |  Private IP: ${LIVEKIT_PRIVATE_IP}"


# ============================================================
# Done!
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}================================================${NC}"
echo -e "${GREEN}${BOLD}   ✅ LiveKit deployed!                         ${NC}"
echo -e "${GREEN}${BOLD}================================================${NC}"
echo ""
echo -e "  ${BOLD}Instance:${NC}    ${CYAN}${LIVEKIT_INSTANCE_ID}${NC}"
echo -e "  ${BOLD}Public IP:${NC}   ${CYAN}${LIVEKIT_PUBLIC_IP}${NC}"
echo -e "  ${BOLD}Private IP:${NC}  ${CYAN}${LIVEKIT_PRIVATE_IP}${NC}"
echo ""
echo -e "  ${BOLD}Domain:${NC}      ${CYAN}${LIVEKIT_DOMAIN}${NC}"
echo -e "  ${BOLD}TURN:${NC}        ${CYAN}${LIVEKIT_TURN_DOMAIN}${NC}"
echo -e "  ${BOLD}WHIP:${NC}        ${CYAN}${LIVEKIT_WHIP_DOMAIN}${NC}"
echo -e "  ${BOLD}Webhook:${NC}     ${CYAN}${LIVEKIT_WEBHOOK_DOMAIN}${NC}"
echo ""
echo -e "  ${BOLD}LIVEKIT_URL:${NC}         ${CYAN}wss://${LIVEKIT_DOMAIN}${NC}"
echo -e "  ${BOLD}LIVEKIT_API_KEY:${NC}     ${CYAN}${LIVEKIT_API_KEY}${NC}"
echo -e "  ${BOLD}LIVEKIT_API_SECRET:${NC}  ${CYAN}${LIVEKIT_API_SECRET}${NC}"
echo ""
echo -e "  ${YELLOW}⚠${NC}  Point ${LIVEKIT_DOMAIN}, ${LIVEKIT_TURN_DOMAIN}, and ${LIVEKIT_WHIP_DOMAIN} at"
echo -e "     ${LIVEKIT_PUBLIC_IP} (A records) — Caddy won't get TLS certs until they resolve."
echo ""

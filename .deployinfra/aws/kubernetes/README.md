# LiveKit Kubernetes Deployment on AWS EKS

This directory contains Kubernetes manifests for deploying LiveKit to AWS EKS with load balancing, autoscaling, and high availability.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Internet                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                │                                    │
                │ HTTPS (443)                        │ UDP (3478)
                │ WebSocket                          │ TCP (5349, 1935)
                ▼                                    ▼
┌───────────────────────────┐        ┌───────────────────────────┐
│   Application Load        │        │   Network Load            │
│   Balancer (ALB)          │        │   Balancer (NLB)          │
│   ─────────────────────   │        │   ─────────────────────   │
│   • TLS termination       │        │   • Layer 4 passthrough   │
│   • WebSocket routing     │        │   • TURN UDP/TCP          │
│   • Health checks         │        │   • RTMP ingress          │
└───────────────────────────┘        └───────────────────────────┘
                │                                    │
                └──────────────┬─────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EKS Cluster                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        livekit namespace                               │  │
│  │                                                                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Node 1    │  │   Node 2    │  │   Node 3    │  │   Node N    │  │  │
│  │  │ ─────────── │  │ ─────────── │  │ ─────────── │  │ ─────────── │  │  │
│  │  │ LiveKit Pod │  │ LiveKit Pod │  │ LiveKit Pod │  │ LiveKit Pod │  │  │
│  │  │ + Caddy     │  │ + Caddy     │  │ + Caddy     │  │ + Caddy     │  │  │
│  │  │ (DaemonSet) │  │ (DaemonSet) │  │ (DaemonSet) │  │ (DaemonSet) │  │  │
│  │  │             │  │             │  │             │  │             │  │  │
│  │  │ hostNetwork │  │ hostNetwork │  │ hostNetwork │  │ hostNetwork │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │                                                                        │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐                     │  │
│  │  │      Egress         │  │      Ingress        │                     │  │
│  │  │   (Deployment)      │  │   (Deployment)      │                     │  │
│  │  │   Recording/RTMP    │  │   RTMP/WHIP input   │                     │  │
│  │  └─────────────────────┘  └─────────────────────┘                     │  │
│  │                                                                        │  │
│  │  ┌─────────────────────┐                                              │  │
│  │  │       Redis         │◄───── Required for multi-node clustering     │  │
│  │  │   (Deployment)      │                                              │  │
│  │  └─────────────────────┘                                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                     Karpenter / Cluster Autoscaler                      ││
│  │                     Scales nodes based on demand                        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. DaemonSet with Host Networking

LiveKit runs as a **DaemonSet** (one pod per node) with `hostNetwork: true` because:

- **WebRTC requires direct UDP access**: Media flows over UDP ports 50000-60000. NAT and port mapping break WebRTC's ICE negotiation.
- **One pod per node**: With host networking, only one LiveKit can bind to port 7880. DaemonSet ensures exactly one.
- **Horizontal scaling = more nodes**: The Cluster Autoscaler/Karpenter adds nodes when demand increases.

### 2. Dual Load Balancers

| Load Balancer | Type | Purpose | Ports |
|--------------|------|---------|-------|
| **ALB** | Application (L7) | WebSocket signaling, HTTP API | 443 |
| **NLB** | Network (L4) | TURN relay, RTMP ingress | 3478, 5349, 1935 |

ALB handles HTTP/WebSocket with TLS termination. NLB handles raw TCP/UDP for TURN and RTMP.

### 3. Graceful Draining (5 Hours)

`terminationGracePeriodSeconds: 18000` gives rooms 5 hours to complete naturally when nodes drain. LiveKit stops accepting new rooms but keeps existing ones running.

### 4. Redis for Clustering

Redis is **required** for multi-node deployments. It provides:
- Room state synchronization
- Participant routing to the correct server
- Egress/Ingress job coordination

## File Structure

```
kubernetes/
├── 00-namespace.yaml       # Isolated namespace
├── 01-secrets.yaml         # API keys, passwords
├── 02-configmap.yaml       # LiveKit, Egress, Ingress, Caddy configs
├── 03-redis.yaml           # Redis deployment + service
├── 04-livekit-server.yaml  # LiveKit DaemonSet + Caddy sidecar
├── 05-egress.yaml          # Egress deployment + HPA
├── 06-ingress.yaml         # Ingress deployment
├── 07-alb-ingress.yaml     # AWS ALB + NLB configuration
├── 08-node-autoscaling.yaml # Karpenter, VPA, PDB
├── 09-monitoring.yaml      # Prometheus ServiceMonitor + alerts
├── deploy.sh               # Deployment script
└── README.md               # This file
```

## Prerequisites

1. **AWS EKS Cluster** with:
   - AWS Load Balancer Controller installed
   - Cluster Autoscaler or Karpenter configured
   - VPC with public subnets

2. **Node Group** labeled for LiveKit:
   ```bash
   eksctl create nodegroup \
     --cluster your-cluster \
     --name livekit-nodes \
     --node-type c5.xlarge \
     --nodes 2 \
     --node-labels livekit.io/node-pool=livekit
   ```

3. **Security Groups** allowing:
   - TCP: 443, 7880, 7881, 5349, 1935, 8080
   - UDP: 3478, 50000-60000

4. **ACM Certificate** for your domains

5. **.env.deploy** with required variables

## Required Environment Variables

Add these to `.env.deploy`:

```bash
# EKS cluster
CLUSTER_NAME=your-eks-cluster
AWS_REGION=ap-south-2

# Domains
LIVEKIT_DOMAIN=livekit.yourdomain.com
LIVEKIT_TURN_DOMAIN=turn.yourdomain.com
LIVEKIT_WHIP_DOMAIN=whip.yourdomain.com
LIVEKIT_WEBHOOK_DOMAIN=app.yourdomain.com

# Credentials (auto-generated if not set)
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
REDIS_PASSWORD=

# AWS
IAM_PROFILE_NAME=your-ec2-instance-profile
ACM_CERTIFICATE_ARN=arn:aws:acm:region:account:certificate/xxx
```

## Deployment

### Quick Start

```bash
# Preview changes (dry run)
./deploy.sh --dry-run

# Deploy
./deploy.sh

# Delete everything
./deploy.sh --delete
```

### Manual Deployment

```bash
# 1. Create namespace
kubectl apply -f 00-namespace.yaml

# 2. Create secrets (edit values first!)
kubectl apply -f 01-secrets.yaml

# 3. Create config
kubectl apply -f 02-configmap.yaml

# 4. Deploy Redis
kubectl apply -f 03-redis.yaml

# 5. Deploy LiveKit server
kubectl apply -f 04-livekit-server.yaml

# 6. Deploy Egress/Ingress
kubectl apply -f 05-egress.yaml
kubectl apply -f 06-ingress.yaml

# 7. Configure load balancers
kubectl apply -f 07-alb-ingress.yaml
```

## Scaling

### Horizontal Scaling (More Nodes)

LiveKit scales horizontally by adding nodes. Each node runs one LiveKit pod.

**With Karpenter** (recommended):
- Pods are automatically scheduled on new nodes when pending
- Configured in `08-node-autoscaling.yaml`

**With Cluster Autoscaler**:
```bash
# Scale node group
eksctl scale nodegroup \
  --cluster your-cluster \
  --name livekit-nodes \
  --nodes 5
```

### Vertical Scaling (Bigger Nodes)

For large rooms (100+ participants), use larger instance types:

| Instance | vCPU | Memory | Typical Capacity |
|----------|------|--------|------------------|
| c5.xlarge | 4 | 8 GB | ~50 participants |
| c5.2xlarge | 8 | 16 GB | ~150 participants |
| c5.4xlarge | 16 | 32 GB | ~300 participants |

The VPA in `08-node-autoscaling.yaml` provides recommendations (set to "Off" mode to avoid disruptions).

## DNS Configuration

After deployment, configure DNS:

| Domain | Record Type | Target |
|--------|-------------|--------|
| livekit.yourdomain.com | CNAME | ALB DNS name |
| whip.yourdomain.com | CNAME | ALB DNS name |
| turn.yourdomain.com | CNAME | NLB DNS name |

Get the DNS names:
```bash
# ALB
kubectl get ingress livekit-alb -n livekit -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# NLB
kubectl get service livekit-nlb -n livekit -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## Monitoring

### Check Status

```bash
# All pods
kubectl get pods -n livekit

# LiveKit logs
kubectl logs -n livekit -l app.kubernetes.io/name=livekit -f

# HPA status
kubectl get hpa -n livekit
```

### Prometheus Metrics

LiveKit exposes metrics at `:7880/metrics`. The ServiceMonitor in `09-monitoring.yaml` configures Prometheus scraping.

Key metrics:
- `livekit_room_count` - Active rooms
- `livekit_room_participant_count` - Total participants
- `livekit_room_packet_loss_ratio` - Media quality
- `livekit_node_room_count` - Rooms per node

## Troubleshooting

### Pods stuck in Pending

```bash
# Check node labels
kubectl get nodes --show-labels | grep livekit

# Check pod events
kubectl describe pod -n livekit <pod-name>
```

Usually caused by missing node label `livekit.io/node-pool=livekit`.

### WebRTC Connection Failures

1. Check security groups allow UDP 50000-60000
2. Verify nodes have public IPs
3. Check TURN is accessible: `nc -u turn.yourdomain.com 3478`

### Redis Connection Issues

```bash
# Check Redis is running
kubectl get pods -n livekit -l app.kubernetes.io/name=redis

# Test connection from LiveKit pod
kubectl exec -n livekit -it <livekit-pod> -- redis-cli -h redis-service ping
```

### Certificate Issues

ALB requires ACM certificate. Check:
```bash
aws acm list-certificates --region your-region
```

## Comparison: EC2 vs Kubernetes

| Aspect | EC2 (lk.sh) | Kubernetes |
|--------|-------------|------------|
| Scaling | Manual/ASG | Automatic (Karpenter/CA) |
| High Availability | Manual setup | Built-in (multi-node) |
| Updates | Instance replacement | Rolling updates |
| Complexity | Simpler | More complex |
| Cost | Lower baseline | Higher baseline |
| Best for | Small deployments | Large/variable loads |

Choose EC2 for simple, predictable workloads. Choose Kubernetes for elastic scaling and high availability.

## Security Considerations

1. **Secrets Management**: Use AWS Secrets Manager + External Secrets Operator instead of Kubernetes Secrets for production.

2. **Network Policies**: Consider adding NetworkPolicy resources to restrict pod-to-pod communication.

3. **Pod Security**: LiveKit and Egress need elevated permissions (hostNetwork, SYS_ADMIN). Run on dedicated nodes with appropriate taints.

4. **TLS**: All external traffic should use TLS. ALB handles TLS termination with ACM certificates.

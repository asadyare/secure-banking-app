# Custom Checkov compliance (Baawisan Bank)

This folder holds **Python-based custom policies** for Terraform AWS resources used by the static frontend module (`terraform/modules/aws_static_site`).

## Policy IDs

| ID | Resource(s) | Intent |
|----|-------------|--------|
| `CKV_BAAWISAN_1` | `aws_s3_bucket_public_access_block` | All four block flags must be `true` (no public ACLs/policy/paths). |
| `CKV_BAAWISAN_2` | `aws_cloudfront_distribution` | `default_cache_behavior.viewer_protocol_policy` is `redirect-to-https` or `https-only`. |
| `CKV_BAAWISAN_3` | `aws_cloudfront_distribution` | At least one `origin` must set `origin_access_control_id` or legacy OAI (no anonymous S3). |
| `CKV_BAAWISAN_4` | `aws_s3_bucket_versioning` | `versioning_configuration.status` is `Enabled`. |
| `CKV_BAAWISAN_5` | `aws_s3_bucket_server_side_encryption_configuration` | Default SSE uses `AES256` or `aws:kms`. |

Built-in Bridgecrew / Checkov AWS checks still apply (see root `checkov.yaml`).

## Run locally

```bash
pip install -r checkov/requirements.txt
checkov --config-file checkov.yaml --external-checks-dir checkov/custom_checks
```

Scan only the module:

```bash
checkov -d terraform/modules/aws_static_site --external-checks-dir checkov/custom_checks --framework terraform
```

## Suppress a line (use sparingly)

In Terraform:

```hcl
# checkov:skip=CKV_BAAWISAN_2: Reason documented in ticket
```

## Extending

Add a new file under `checkov/custom_checks/` extending `BaseResourceCheck` from Checkov. Use IDs `CKV_BAAWISAN_*` to avoid collisions with Bridgecrew `CKV_AWS_*` / `CKV2_*`.

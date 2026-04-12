"""
Baawisan compliance: S3 default encryption must use AES256 or aws:kms (no plaintext-at-rest expectation).
"""

from checkov.common.models.enums import CheckCategories, CheckResult
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

from baawisan_common import unwrap, as_str


class S3BucketEncryptionSseEnabled(BaseResourceCheck):
    def __init__(self) -> None:
        name = "Ensure S3 bucket server-side encryption uses AES256 or KMS"
        id = "CKV_BAAWISAN_5"
        supported_resources = ("aws_s3_bucket_server_side_encryption_configuration",)
        categories = (CheckCategories.ENCRYPTION,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def scan_resource_conf(self, conf):  # type: ignore[no-untyped-def]
        rules = unwrap(conf.get("rule"))
        if not rules:
            return CheckResult.FAILED
        items = rules if isinstance(rules, list) else [rules]
        for rule in items:
            if not isinstance(rule, dict):
                continue
            apply = unwrap(rule.get("apply_server_side_encryption_by_default"))
            if not apply:
                continue
            blocks = apply if isinstance(apply, list) else [apply]
            for block in blocks:
                if not isinstance(block, dict):
                    continue
                algo = as_str(block.get("sse_algorithm")).upper()
                if algo in ("AES256", "AWS:KMS"):
                    return CheckResult.PASSED
        return CheckResult.FAILED

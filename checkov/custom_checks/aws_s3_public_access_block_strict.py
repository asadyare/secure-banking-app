"""
Baawisan compliance: S3 account/bucket public access must be fully blocked.
Maps to organizational policy for static website buckets (private + CloudFront OAC).
"""

from checkov.common.models.enums import CheckCategories, CheckResult
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

from baawisan_common import as_bool


class S3PublicAccessFullyBlocked(BaseResourceCheck):
    def __init__(self) -> None:
        name = "Ensure S3 public access block resources block all public access paths"
        id = "CKV_BAAWISAN_1"
        supported_resources = ("aws_s3_bucket_public_access_block",)
        categories = (CheckCategories.NETWORKING,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def scan_resource_conf(self, conf):  # type: ignore[no-untyped-def]
        keys = (
            "block_public_acls",
            "block_public_policy",
            "ignore_public_acls",
            "restrict_public_buckets",
        )
        for key in keys:
            if key not in conf:
                return CheckResult.FAILED
            if not as_bool(conf[key]):
                return CheckResult.FAILED
        return CheckResult.PASSED

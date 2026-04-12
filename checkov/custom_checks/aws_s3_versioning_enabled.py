"""
Baawisan compliance: S3 buckets used for production artifacts should have versioning enabled.
"""

from checkov.common.models.enums import CheckCategories, CheckResult
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

from baawisan_common import unwrap, as_str


class S3BucketVersioningEnabled(BaseResourceCheck):
    def __init__(self) -> None:
        name = "Ensure S3 bucket versioning configuration status is Enabled"
        id = "CKV_BAAWISAN_4"
        supported_resources = ("aws_s3_bucket_versioning",)
        categories = (CheckCategories.BACKUP_AND_RECOVERY,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def scan_resource_conf(self, conf):  # type: ignore[no-untyped-def]
        vc = unwrap(conf.get("versioning_configuration"))
        if not vc:
            return CheckResult.FAILED
        blocks = vc if isinstance(vc, list) else [vc]
        for block in blocks:
            if not isinstance(block, dict):
                continue
            status = as_str(block.get("status")).lower()
            if status == "enabled":
                return CheckResult.PASSED
        return CheckResult.FAILED

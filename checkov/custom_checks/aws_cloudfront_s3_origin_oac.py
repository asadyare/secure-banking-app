"""
Baawisan compliance: CloudFront origins to S3 must use Origin Access Control (not legacy public S3).
"""

from checkov.common.models.enums import CheckCategories, CheckResult
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

from baawisan_common import unwrap, as_str


class CloudFrontS3OriginUsesOAC(BaseResourceCheck):
    def __init__(self) -> None:
        name = "Ensure CloudFront S3 origins set origin_access_control_id (OAC/OAI pattern)"
        id = "CKV_BAAWISAN_3"
        supported_resources = ("aws_cloudfront_distribution",)
        categories = (CheckCategories.IAM,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def scan_resource_conf(self, conf):  # type: ignore[no-untyped-def]
        origins = unwrap(conf.get("origin"))
        if not origins:
            return CheckResult.FAILED
        items = origins if isinstance(origins, list) else [origins]
        for item in items:
            if not isinstance(item, dict):
                continue
            oac = item.get("origin_access_control_id")
            oai = item.get("origin_access_identity")  # legacy OAI
            if as_str(oac):
                return CheckResult.PASSED
            if oai:  # older pattern; still not anonymous S3
                return CheckResult.PASSED
        return CheckResult.FAILED

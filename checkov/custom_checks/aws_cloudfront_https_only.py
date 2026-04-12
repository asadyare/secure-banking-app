"""
Baawisan compliance: CloudFront default cache behavior must force HTTPS for viewers.
"""

from checkov.common.models.enums import CheckCategories, CheckResult
from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck

from baawisan_common import unwrap


class CloudFrontDefaultBehaviorHttps(BaseResourceCheck):
    def __init__(self) -> None:
        name = "Ensure CloudFront default cache behavior uses HTTPS (redirect or https-only)"
        id = "CKV_BAAWISAN_2"
        supported_resources = ("aws_cloudfront_distribution",)
        categories = (CheckCategories.ENCRYPTION,)
        super().__init__(name=name, id=id, categories=categories, supported_resources=supported_resources)

    def scan_resource_conf(self, conf):  # type: ignore[no-untyped-def]
        behaviors = unwrap(conf.get("default_cache_behavior"))
        if not behaviors:
            return CheckResult.FAILED
        if isinstance(behaviors, list) and behaviors:
            first = behaviors[0]
        else:
            first = behaviors
        if not isinstance(first, dict):
            return CheckResult.FAILED
        policy = unwrap(first.get("viewer_protocol_policy"))
        if policy in ("redirect-to-https", "https-only"):
            return CheckResult.PASSED
        return CheckResult.FAILED

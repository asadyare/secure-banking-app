"""Shared value unwrapping for Baawisan custom Checkov policies."""


def unwrap(val):
    """HCL values often appear as single-element lists."""
    if val is None:
        return None
    if isinstance(val, list):
        if len(val) == 1:
            return unwrap(val[0])
        return val
    return val


def as_bool(val) -> bool:
    u = unwrap(val)
    if u is True or u is False:
        return bool(u)
    if isinstance(u, str):
        return u.lower() in ("true", "1", "yes")
    return bool(u)


def as_str(val) -> str:
    u = unwrap(val)
    if u is None:
        return ""
    return str(u).strip()

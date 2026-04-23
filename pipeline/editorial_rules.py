from pipeline.models import StoryKind

WORD_LIMITS_BY_KIND: dict[StoryKind, tuple[int, int]] = {
    "lead": (450, 700),
    "secondary": (320, 500),
    "brief": (220, 350),
}

PARAGRAPH_LIMITS_BY_KIND: dict[StoryKind, tuple[int, int]] = {
    "lead": (5, 6),
    "secondary": (4, 5),
    "brief": (3, 3),
}


def describe_word_limits() -> str:
    return (
        "lead=450-700 palavras; "
        "secondary=320-500 palavras; "
        "brief=220-350 palavras"
    )


def describe_paragraph_limits() -> str:
    return "lead=5-6 paragrafos; secondary=4-5; brief=3"

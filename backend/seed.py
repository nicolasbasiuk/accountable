"""What npm run seed runs: save a copy, ask, then reset to the sample data (R5, R6)."""

import sys

from accountable import seeding

QUESTION = "Replace all the data with the sample data? Type yes to continue: "


def confirmed(arguments: list[str]) -> bool:
    if "--yes" in arguments:
        return True
    if not sys.stdin.isatty():
        raise SystemExit("There's no one to ask, so nothing was changed. Add --yes to skip the question.")
    try:
        return input(QUESTION).strip().lower() in ("y", "yes")
    except EOFError:
        return False


def main(arguments: list[str]) -> None:
    copy = seeding.save_copy()
    if copy:
        print(f"Saved a copy of the data: {copy}")
    if not confirmed(arguments):
        print("Nothing was changed.")
        return
    seeding.reset()
    print("The data is now the sample data.")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except KeyboardInterrupt:
        raise SystemExit("\nNothing was changed.") from None

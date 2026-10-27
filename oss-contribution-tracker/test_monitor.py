import unittest
from unittest.mock import patch

import monitor


class DigestTests(unittest.TestCase):
    def test_mentions_are_inert_for_new_and_existing_issues(self):
        body = 'Comment from @reviewer: "@AlexWaygood @org/team please review"'
        for issue in (None, 1):
            with self.subTest(issue=issue):
                with patch.object(monitor, "find_open_digest_issue", return_value=issue):
                    with patch.object(monitor, "run") as run:
                        monitor.post_digest(body)
                command = run.call_args.args[0]
                posted = command[command.index("--body") + 1]
                self.assertNotIn("@", posted)
                self.assertEqual(posted, body.replace("@", "＠"))

    def test_activity_detection_keeps_unchanged_items_silent(self):
        current = {"url": "https://github.com/example/repo/pull/1",
                   "state": "open", "comments": 2,
                   "last_comment": {"author": "reviewer", "first_line": "@Builder106 update?"}}
        self.assertEqual(monitor.diff_lines(None, current), [])
        self.assertEqual(monitor.diff_lines(current, current), [])
        previous = dict(current, comments=1, state="closed")
        self.assertEqual(len(monitor.diff_lines(previous, current)), 2)


if __name__ == "__main__":
    unittest.main()

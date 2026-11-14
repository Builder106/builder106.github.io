import contextlib
import importlib.util
import io
import json
import pathlib
import subprocess
import unittest
from unittest import mock


ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("tracker_refresh", ROOT / "refresh.py")
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


class TestInventFallback(unittest.TestCase):
    def test_unavailable_invent_keeps_saved_results_and_marks_them(self):
        snapshot = json.loads((ROOT / "data.json").read_text(encoding="utf-8"))
        saved = next(repo for repo in snapshot["repos"] if repo["key"] == "glaxnimate")
        with mock.patch.object(refresh, "invent_items", side_effect=subprocess.CalledProcessError(22, "curl")):
            with contextlib.redirect_stderr(io.StringIO()):
                issues, prs, stale = refresh.invent_data("graphics/glaxnimate")
        self.assertEqual(issues, saved["issues"])
        self.assertEqual(prs, saved["prs"])
        self.assertTrue(stale)

        saved["stale"] = True
        html = refresh.build_html(snapshot)
        self.assertIn("KDE Invent unavailable; showing last saved results.", html)
        self.assertIn("KDE Glaxnimate (saved results)", html)
        self.assertIn("https://invent.kde.org/graphics/glaxnimate/-/merge_requests/118", html)


if __name__ == "__main__":
    unittest.main()

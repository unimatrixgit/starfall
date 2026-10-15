# Universe alliance views

Universe has three page sections: Total overview, Planets & statistics, and Alliances. Total overview stacks the existing planet view above the alliance view. The other buttons display one view without copying or duplicating the existing form elements.

Alliance rankings use the latest public planet directory membership and reported score. They show the top ten alliances, with a selector for every reported alliance and a per-member detail table. Exiled members remain counted until their recorded membership changes. Unaffiliated planets, dummy planets, structure planets and ghost memorials are excluded from alliance totals. Own planet measurements use the same current local readings already displayed elsewhere in the game.

The module never reads alliance profiles, scans, private intel records, funds, rank permissions or reserve balances. The requested public membership presentation is distinct from private alliance intelligence assessments in the original planet directory view.

Missing public XP remains null in the public directory projection instead of being fabricated as zero. A member's unknown measurement appears as an em dash. Totals include known measurements only and are marked with an asterisk if incomplete; reporting coverage is shown in the detail module. A genuinely reported zero remains zero. Public reports can be from different ticks and are not presented as a synchronized snapshot.

The module wraps the existing universe renderer and navigation function to refresh the current view on ordinary game updates and when Universe is opened. It does not introduce a polling loop, new API endpoint, persistent cache or gameplay write. Load `universe-alliances.js` after `game.js` and before the runtime's final initial update.

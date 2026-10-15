# SF-107 Ecological population growth

Explicit user correction supersedes the zero-Biodome/no-growth rule examined under SF-106.

Ecology = (habitability + biodiversity + moisture + 100 - rockiness) / 400. Environmental stats are bounded to0–100; missing legacy stats use50.

Base growth = (1 + ecology) × founding population /1000.

Potential growth = (base growth + completed Biodomes) × (1 +0.2×Demography level) × max(0.01,1 +planet growth percent/100).

All existing ecological survey measurements therefore contribute; founding population scales the baseline, and the existing environment growth modifier remains active. Trade discounts and fleet travel bonuses retain their existing unrelated effects. Fractional growth accumulates: a positive rate below one need not create a whole resident or resource-equivalent every tick.

Below housing capacity growth produces residents. At verified full housing, all potential growth instead contributes to the Galaxy Fund at6metal/4crystal/2eonium per whole resident-equivalent. The ordinary0–5per24ticks resident levy remains independent; full-housing conversion works at ordinaryzero and removes no existing residents. The prior ecological snapshot guard, generation/reset fences, rolling ordinary cap and exactly-once settlement remain. Unobserved past ticks are not charged retrospectively.

Tests cover all five base inputs, positive fractional growth on the harshest original world without Biodomes, backend/frontend base-expression parity, zero-Biodome full-housing conversion and repeated-read idempotency. Actual local Worker/browser test with0Biodomes and ordinaryzero credited12M8C4E after one observed tick without changing resident count.

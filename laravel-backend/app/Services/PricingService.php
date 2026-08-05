<?php

namespace App\Services;

use App\Models\TieredPricingRule;

class PricingService
{
    /**
     * Calculate total price and discount based on active tiered rules.
     */
    public function calculatePricing(int $totalHours, float $defaultBaseRate = 10.00): array
    {
        if ($totalHours <= 0) {
            return [
                'total_hours' => 0,
                'subtotal' => 0.00,
                'effective_rate_per_hour' => $defaultBaseRate,
                'discount_amount' => 0.00,
                'final_total' => 0.00,
                'tier_applied' => null,
            ];
        }

        $subtotal = $totalHours * $defaultBaseRate;

        // Fetch active rules ordered by min_hours DESC
        $activeRules = TieredPricingRule::where('is_active', true)
            ->orderBy('min_hours', 'desc')
            ->get();

        $matchingRule = $activeRules->first(function ($rule) use ($totalHours) {
            return $totalHours >= $rule->min_hours && $totalHours <= $rule->max_hours;
        });

        $effectiveRate = $matchingRule ? $matchingRule->rate_per_hour : $defaultBaseRate;
        $finalTotal = $totalHours * $effectiveRate;
        $discountAmount = max(0.00, $subtotal - $finalTotal);

        return [
            'total_hours' => $totalHours,
            'subtotal' => round($subtotal, 2),
            'effective_rate_per_hour' => round($effectiveRate, 2),
            'discount_amount' => round($discountAmount, 2),
            'final_total' => round($finalTotal, 2),
            'tier_applied' => $matchingRule ? $matchingRule->description : 'Base Hourly Rate',
        ];
    }
}

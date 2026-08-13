<?php

namespace Tests\Feature;

use App\Models\TieredPricingRule;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Pricing rules used to be add-only, which made a mistyped rate permanent
 * through the dashboard — every other admin resource could already be removed.
 */
class AdminPricingRuleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_an_admin_can_delete_a_pricing_rule(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $rule = TieredPricingRule::create([
            'min_hours' => 5,
            'max_hours' => 6,
            'rate_per_hour' => 5,
            'description' => 'Mistyped rate',
            'is_active' => true,
        ]);

        $this->deleteJson("/api/admin/pricing-rules/{$rule->id}")->assertOk();

        $this->assertDatabaseMissing('tiered_pricing_rules', ['id' => $rule->id]);
    }

    public function test_deleting_a_rule_restores_the_previous_price(): void
    {
        // The seeded 3-24 tier charges 7/hr. A narrower 5-6 tier wins while it
        // exists (PricingService takes the highest matching min_hours), so
        // removing it must hand the bracket back to the original rule.
        Sanctum::actingAs(User::factory()->create());

        $before = $this->postJson('/api/pricing/calculate', ['totalHours' => 5])->json('finalTotal');

        $rule = TieredPricingRule::create([
            'min_hours' => 5,
            'max_hours' => 6,
            'rate_per_hour' => 5,
            'description' => 'Temporary promo',
            'is_active' => true,
        ]);

        $during = $this->postJson('/api/pricing/calculate', ['totalHours' => 5])->json('finalTotal');
        $this->assertSame(25.0, (float) $during);

        $this->deleteJson("/api/admin/pricing-rules/{$rule->id}")->assertOk();

        $after = $this->postJson('/api/pricing/calculate', ['totalHours' => 5])->json('finalTotal');
        $this->assertSame((float) $before, (float) $after);
    }

    public function test_deleting_a_pricing_rule_requires_authentication(): void
    {
        $rule = TieredPricingRule::first();

        $this->deleteJson("/api/admin/pricing-rules/{$rule->id}")->assertStatus(401);

        $this->assertDatabaseHas('tiered_pricing_rules', ['id' => $rule->id]);
    }

    public function test_deleting_every_rule_falls_back_to_the_base_hourly_rate(): void
    {
        Sanctum::actingAs(User::factory()->create());

        foreach (TieredPricingRule::all() as $rule) {
            $this->deleteJson("/api/admin/pricing-rules/{$rule->id}")->assertOk();
        }

        $response = $this->postJson('/api/pricing/calculate', ['totalHours' => 3])->assertOk();

        $this->assertSame(10.0, (float) $response->json('effectiveRatePerHour'));
        $this->assertSame(0.0, (float) $response->json('discountAmount'));
    }
}

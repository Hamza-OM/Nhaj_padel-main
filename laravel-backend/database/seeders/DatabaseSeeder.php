<?php

namespace Database\Seeders;

use App\Models\Court;
use App\Models\TieredPricingRule;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with the default 8 courts and the
     * tiered pricing rules used by the Padel Court Booking Platform.
     */
    public function run(): void
    {
        if (Court::count() === 0) {
            for ($i = 1; $i <= 8; $i++) {
                Court::create([
                    'name' => "Court {$i}",
                    'base_price_per_hour' => 10,
                    'opening_time' => '07:00:00',
                    'closing_time' => '23:00:00',
                    'is_active' => true,
                    'surface_type' => 'Professional Padel Turf',
                ]);
            }
        }

        if (TieredPricingRule::count() === 0) {
            TieredPricingRule::insert([
                [
                    'min_hours' => 1,
                    'max_hours' => 1,
                    'rate_per_hour' => 10,
                    'description' => '1 Hour Base Rate (10 OMR/hr)',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'min_hours' => 2,
                    'max_hours' => 2,
                    'rate_per_hour' => 8,
                    'description' => '2 Hours Tier Offer (8 OMR/hr - Save 20%)',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'min_hours' => 3,
                    'max_hours' => 24,
                    'rate_per_hour' => 7,
                    'description' => '3+ Hours Special Tier Offer (7 OMR/hr - Save 30%)',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }
}

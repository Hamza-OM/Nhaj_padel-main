<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TieredPricingRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'minHours' => (int) $this->min_hours,
            'maxHours' => (int) $this->max_hours,
            'ratePerHour' => (float) $this->rate_per_hour,
            'description' => $this->description,
            'isActive' => (bool) $this->is_active,
        ];
    }
}

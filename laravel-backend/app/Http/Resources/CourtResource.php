<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourtResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'basePricePerHour' => (float) $this->base_price_per_hour,
            'openingTime' => substr($this->opening_time, 0, 5),
            'closingTime' => substr($this->closing_time, 0, 5),
            'isActive' => (bool) $this->is_active,
            'surfaceType' => $this->surface_type,
            'createdAt' => optional($this->created_at)->toISOString(),
        ];
    }
}

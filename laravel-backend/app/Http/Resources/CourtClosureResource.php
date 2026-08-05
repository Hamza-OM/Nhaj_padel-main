<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourtClosureResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'courtId' => $this->court_id === null ? 'ALL' : (string) $this->court_id,
            'startDate' => $this->start_date instanceof \DateTimeInterface
                ? $this->start_date->format('Y-m-d')
                : $this->start_date,
            'endDate' => $this->end_date instanceof \DateTimeInterface
                ? $this->end_date->format('Y-m-d')
                : $this->end_date,
            'reason' => $this->reason,
            'createdAt' => optional($this->created_at)->toISOString(),
        ];
    }
}

<?php

namespace App\Http\Controllers;

use App\Http\Resources\CourtClosureResource;
use App\Http\Resources\CourtResource;
use App\Http\Resources\TieredPricingRuleResource;
use App\Models\Court;
use App\Models\CourtClosure;
use App\Models\TieredPricingRule;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminCourtController extends Controller
{
    // GET /api/admin/courts
    public function index(): JsonResponse
    {
        return response()->json(CourtResource::collection(Court::all()));
    }

    // POST /api/admin/courts
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'               => 'required|string|max:100',
            'basePricePerHour'   => 'required|numeric|min:0',
            'openingTime'        => 'required|string',
            'closingTime'        => 'required|string',
            'surfaceType'        => 'nullable|string',
        ]);

        $court = Court::create([
            'name'                 => $validated['name'],
            'base_price_per_hour'  => $validated['basePricePerHour'],
            'opening_time'         => $validated['openingTime'],
            'closing_time'         => $validated['closingTime'],
            'surface_type'         => $validated['surfaceType'] ?? null,
            'is_active'            => true,
        ]);

        return response()->json(new CourtResource($court), 201);
    }

    // PUT /api/admin/courts/{court}
    public function update(Request $request, Court $court): JsonResponse
    {
        $validated = $request->validate([
            'name'               => 'sometimes|string|max:100',
            'basePricePerHour'   => 'sometimes|numeric|min:0',
            'openingTime'        => 'sometimes|string',
            'closingTime'        => 'sometimes|string',
            'isActive'           => 'sometimes|boolean',
            'surfaceType'        => 'nullable|string',
        ]);

        $court->update(array_filter([
            'name'                 => $validated['name'] ?? null,
            'base_price_per_hour'  => $validated['basePricePerHour'] ?? null,
            'opening_time'         => $validated['openingTime'] ?? null,
            'closing_time'         => $validated['closingTime'] ?? null,
            'is_active'            => $validated['isActive'] ?? null,
            'surface_type'         => $validated['surfaceType'] ?? null,
        ], fn ($v) => $v !== null));

        return response()->json(new CourtResource($court->fresh()));
    }

    // DELETE /api/admin/courts/{court}
    public function destroy(Court $court): JsonResponse
    {
        try {
            $court->delete();
        } catch (QueryException $e) {
            return response()->json([
                'message' => 'Cannot delete this court because it has existing bookings on record. Deactivate it instead to remove it from future availability.',
            ], 409);
        }

        return response()->json(['message' => 'Court deleted successfully']);
    }

    // GET /api/admin/closures
    public function getClosures(): JsonResponse
    {
        return response()->json(CourtClosureResource::collection(CourtClosure::all()));
    }

    // POST /api/admin/closures  { courtId, startDate, endDate, reason }
    public function storeClosure(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'courtId'   => 'nullable|string',
            'startDate' => 'required|date_format:Y-m-d',
            'endDate'   => 'required|date_format:Y-m-d|after_or_equal:startDate',
            'reason'    => 'required|string|max:255',
        ]);

        // 'ALL' or missing courtId -> null (all courts closed)
        $courtId = (isset($validated['courtId']) && $validated['courtId'] !== 'ALL')
            ? $validated['courtId']
            : null;

        // Validate court exists when a specific one is given
        if ($courtId !== null) {
            Court::findOrFail($courtId);
        }

        $closure = CourtClosure::create([
            'court_id'   => $courtId,
            'start_date' => $validated['startDate'],
            'end_date'   => $validated['endDate'],
            'reason'     => $validated['reason'],
        ]);

        return response()->json(new CourtClosureResource($closure), 201);
    }

    // DELETE /api/admin/closures/{closure}
    public function destroyClosure(CourtClosure $closure): JsonResponse
    {
        $closure->delete();
        return response()->json(['message' => 'Closure removed successfully']);
    }

    /**
     * Pricing rules were previously add-only, which made a typo permanent —
     * a tier entered as 5 OMR instead of 50 could never be taken back out.
     * Removing the last rule is allowed: PricingService falls back to the
     * base hourly rate when nothing matches.
     */
    public function destroyPricingRule(TieredPricingRule $pricingRule): JsonResponse
    {
        $pricingRule->delete();

        return response()->json(['message' => 'Pricing rule removed successfully']);
    }

    // GET /api/admin/pricing-rules
    public function getPricingRules(): JsonResponse
    {
        return response()->json(TieredPricingRuleResource::collection(TieredPricingRule::all()));
    }

    // POST /api/admin/pricing-rules  { minHours, maxHours, ratePerHour, description }
    public function storePricingRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'minHours'    => 'required|integer|min:1',
            'maxHours'    => 'required|integer|gte:minHours',
            'ratePerHour' => 'required|numeric|min:0',
            'description' => 'required|string|max:255',
        ]);

        $rule = TieredPricingRule::create([
            'min_hours'      => $validated['minHours'],
            'max_hours'      => $validated['maxHours'],
            'rate_per_hour'  => $validated['ratePerHour'],
            'description'    => $validated['description'],
            'is_active'      => true,
        ]);

        return response()->json(new TieredPricingRuleResource($rule), 201);
    }
}

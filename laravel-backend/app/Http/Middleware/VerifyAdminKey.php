<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyAdminKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expectedKey = config('services.admin.api_key');
        $providedKey = $request->header('X-Admin-Key');

        if (! $expectedKey || ! $providedKey || ! hash_equals($expectedKey, $providedKey)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}

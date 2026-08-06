<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Real, server-verified admin authentication (Sanctum personal access
 * tokens), replacing the old shared X-Admin-Key header that was baked into
 * the public frontend bundle and readable by anyone, logged in or not.
 */
class AdminAuthController extends Controller
{
    /**
     * POST /api/admin/login  { email, password }
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        // Same generic message either way — don't reveal whether the email
        // exists.
        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json(['error' => 'Invalid email or password.'], 401);
        }

        $token = $user->createToken('admin-dashboard')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * POST /api/admin/logout
     * Revokes only the token used to make this request — other
     * devices/tabs stay signed in, matching normal Sanctum behavior.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['success' => true]);
    }

    /**
     * GET /api/admin/me
     * Lets the frontend check on load whether a stored token is still valid,
     * without needing to guess from a 401 on some other endpoint.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'name' => $request->user()->name,
            'email' => $request->user()->email,
        ]);
    }
}

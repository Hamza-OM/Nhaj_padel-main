<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * Covers the real admin authentication that replaced the old shared
 * X-Admin-Key header (a secret that was baked into the public frontend
 * bundle and readable by any visitor, regardless of whether they'd ever
 * seen the login screen).
 */
class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_admin_routes_reject_requests_with_no_token(): void
    {
        $this->getJson('/api/admin/courts')
            ->assertStatus(401)
            ->assertJson(['error' => 'Unauthenticated.']);
    }

    public function test_admin_routes_reject_a_bogus_bearer_token(): void
    {
        $this->getJson('/api/admin/courts', ['Authorization' => 'Bearer not-a-real-token'])
            ->assertStatus(401);
    }

    public function test_login_with_correct_seeded_credentials_returns_a_usable_token(): void
    {
        $response = $this->postJson('/api/admin/login', [
            'email' => 'admin@padel.com',
            'password' => 'Demo-5e977ff12f8c',
        ]);

        $response->assertOk()->assertJsonStructure(['token', 'user' => ['name', 'email']]);

        $token = $response->json('token');

        $this->getJson('/api/admin/courts', ['Authorization' => "Bearer {$token}"])
            ->assertOk();
    }

    public function test_login_with_wrong_password_is_rejected(): void
    {
        $this->postJson('/api/admin/login', [
            'email' => 'admin@padel.com',
            'password' => 'wrong-password',
        ])->assertStatus(401);
    }

    public function test_login_with_unknown_email_gives_the_same_generic_error_as_wrong_password(): void
    {
        // Same message either way — confirms the response doesn't leak
        // whether an email is registered.
        $unknown = $this->postJson('/api/admin/login', [
            'email' => 'nobody@example.com',
            'password' => 'Demo-5e977ff12f8c',
        ]);
        $wrongPassword = $this->postJson('/api/admin/login', [
            'email' => 'admin@padel.com',
            'password' => 'wrong-password',
        ]);

        $unknown->assertStatus(401);
        $wrongPassword->assertStatus(401);
        $this->assertSame($unknown->json('error'), $wrongPassword->json('error'));
    }

    public function test_logout_immediately_revokes_the_token(): void
    {
        $token = $this->postJson('/api/admin/login', [
            'email' => 'admin@padel.com',
            'password' => 'Demo-5e977ff12f8c',
        ])->json('token');

        $this->postJson('/api/admin/logout', [], ['Authorization' => "Bearer {$token}"])
            ->assertOk();

        // Laravel's test harness caches the resolved sanctum guard's user
        // across sequential calls within one test method — without this, the
        // next request would see the already-resolved user from the login
        // call above instead of re-checking the (now-deleted) token. This
        // has no equivalent in production, where every request is fresh; a
        // manual curl repro against the real dev server confirmed the actual
        // revocation works correctly without it.
        Auth::forgetGuards();

        $this->getJson('/api/admin/courts', ['Authorization' => "Bearer {$token}"])
            ->assertStatus(401);
    }

    public function test_me_endpoint_confirms_a_valid_token_without_side_effects(): void
    {
        $token = $this->postJson('/api/admin/login', [
            'email' => 'admin@padel.com',
            'password' => 'Demo-5e977ff12f8c',
        ])->json('token');

        $this->getJson('/api/admin/me', ['Authorization' => "Bearer {$token}"])
            ->assertOk()
            ->assertJson(['email' => 'admin@padel.com']);
    }

    public function test_login_is_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/admin/login', [
                'email' => 'admin@padel.com',
                'password' => 'wrong-password',
            ])->assertStatus(401);
        }

        // 6th attempt within the same window should be throttled, not a
        // normal auth failure.
        $this->postJson('/api/admin/login', [
            'email' => 'admin@padel.com',
            'password' => 'wrong-password',
        ])->assertStatus(429);
    }

    public function test_admin_password_is_never_stored_in_plaintext(): void
    {
        $user = User::where('email', 'admin@padel.com')->first();

        $this->assertNotSame('Demo-5e977ff12f8c', $user->password);
        $this->assertStringStartsWith('$2y$', $user->password);
    }
}

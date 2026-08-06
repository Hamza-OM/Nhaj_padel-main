<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);

        // This is a pure JSON API with no 'login' route. Laravel's default
        // guest-redirect logic calls route('login') *eagerly* while building
        // the AuthenticationException — for api/* requests that throws
        // RouteNotFoundException before the exception handler below ever
        // gets a chance to run, turning every unauthenticated request into a
        // 500 instead of a 401. Returning null here skips the redirect
        // attempt entirely for api/* requests.
        $middleware->redirectGuestsTo(fn (\Illuminate\Http\Request $request) => $request->is('api/*') ? null : '/login');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Belt-and-suspenders: guarantees a clean JSON 401 for api/* even if
        // expectsJson() would otherwise have been false (e.g. a client that
        // didn't send an explicit Accept: application/json header).
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['error' => 'Unauthenticated.'], 401);
            }
        });
    })->create();

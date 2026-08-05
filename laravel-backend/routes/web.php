<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| This backend is a pure JSON API consumed by the separate React (Vite)
| frontend. There are no server-rendered views; this route only confirms
| the API is running when visited directly in a browser.
|
*/

Route::get('/', function () {
    return response()->json([
        'name' => config('app.name'),
        'status' => 'ok',
        'api_base' => url('/api'),
    ]);
});

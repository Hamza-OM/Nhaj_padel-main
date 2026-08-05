<?php

return [

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Thawani Payment Gateway (Sandbox)
    |--------------------------------------------------------------------------
    */
    'thawani' => [
        'mode' => env('THAWANI_MODE', 'sandbox'),
        'secret_key' => env('THAWANI_SECRET_KEY'),
        'publishable_key' => env('THAWANI_PUBLISHABLE_KEY'),
        // Separate secret Thawani issues for signing webhook payloads (Merchant Portal
        // > Webhook URL config) — distinct from the API secret key above. Optional: if
        // unset, incoming webhooks are processed without signature verification (fine
        // for local dev with no public URL, but required before ever going live).
        'webhook_secret' => env('THAWANI_WEBHOOK_SECRET'),
    ],

];

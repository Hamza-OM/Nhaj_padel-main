<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * bookings.thawani_session_id / thawani_payment_url predate the payments
     * table. Since payments.provider_session_id (+ metadata) now owns this
     * data — and is the column the webhook/return-URL flow actually queries —
     * these two were left as an unread, unwritten-to-anywhere-except-here
     * duplicate. Confirmed via full-codebase search before dropping: no query
     * anywhere selects a booking by thawani_session_id, and the frontend never
     * reads either field from the booking response.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['thawani_session_id', 'thawani_payment_url']);
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('thawani_session_id')->nullable();
            $table->text('thawani_payment_url')->nullable();
        });
    }
};

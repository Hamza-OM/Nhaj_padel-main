<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Dedicated payment records so a booking can carry several attempts (a
        // cancelled Thawani checkout followed by a successful retry) and so the
        // provider's own identifiers have a home for reconciliation.
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->onDelete('cascade');
            $table->enum('method', ['arrival', 'thawani'])->default('arrival');
            $table->enum('status', ['pending', 'paid', 'failed', 'cancelled', 'expired'])->default('pending');
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('OMR');
            $table->string('provider')->nullable();               // e.g. "thawani"
            $table->string('provider_session_id')->nullable();     // Thawani checkout session_id
            $table->string('provider_transaction_id')->nullable(); // Thawani invoice number
            $table->json('metadata')->nullable();
            $table->timestamps();

            // One payment row per Thawani session — the guard that makes webhook
            // and return-URL processing safe to run repeatedly.
            $table->unique('provider_session_id');
            $table->index(['booking_id', 'status']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            // pending_payment: created and holding its slots, but not yet paid for.
            $table->enum('booking_status', ['pending_payment', 'confirmed', 'cancelled', 'completed'])
                ->default('confirmed')
                ->change();

            // cancelled/expired mirror the terminal states Thawani actually reports.
            $table->enum('payment_status', ['pending', 'paid', 'failed', 'cancelled', 'expired'])
                ->default('pending')
                ->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');

        Schema::table('bookings', function (Blueprint $table) {
            $table->enum('booking_status', ['confirmed', 'cancelled', 'completed'])->default('confirmed')->change();
            $table->enum('payment_status', ['pending', 'paid', 'failed'])->default('pending')->change();
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations for Padel Court Booking Platform.
     */
    public function up(): void
    {
        // 1. Courts Table
        Schema::create('courts', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Internal identification (e.g. Court Alpha)
            $table->decimal('base_price_per_hour', 8, 2)->default(10.00); // Base SAR/OMR
            $table->time('opening_time')->default('07:00:00');
            $table->time('closing_time')->default('23:00:00');
            $table->boolean('is_active')->default(true);
            $table->string('surface_type')->nullable(); // Indoor Panoramic, Outdoor Turf
            $table->timestamps();
        });

        // 2. Court Closures / Blackouts
        Schema::create('court_closures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('court_id')->nullable()->constrained('courts')->onDelete('cascade'); // NULL means ALL courts
            $table->date('start_date');
            $table->date('end_date');
            $table->string('reason');
            $table->timestamps();

            $table->index(['start_date', 'end_date']);
        });

        // 3. Tiered Pricing Rules
        Schema::create('tiered_pricing_rules', function (Blueprint $table) {
            $table->id();
            $table->integer('min_hours');
            $table->integer('max_hours');
            $table->decimal('rate_per_hour', 8, 2);
            $table->string('description');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 4. Bookings Table
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('reference_code')->unique(); // e.g. PAD-98412
            $table->string('customer_phone'); // Mandatory
            $table->string('customer_name')->nullable();
            $table->string('customer_email')->nullable();
            $table->date('booking_date');
            $table->integer('total_duration_hours');
            $table->decimal('subtotal_amount', 10, 2);
            $table->decimal('discount_amount', 10, 2)->default(0.00);
            $table->decimal('total_amount', 10, 2);
            $table->string('currency', 3)->default('OMR');
            $table->enum('payment_method', ['arrival', 'thawani'])->default('arrival');
            $table->enum('payment_status', ['pending', 'paid', 'failed'])->default('pending');
            $table->enum('booking_status', ['confirmed', 'cancelled', 'completed'])->default('confirmed');
            $table->string('thawani_session_id')->nullable();
            $table->text('thawani_payment_url')->nullable();
            $table->timestamps();

            $table->index(['booking_date', 'booking_status']);
            $table->index('customer_phone');
        });

        // 5. Booking Items / Slots (Randomly bound Court IDs at confirmation)
        Schema::create('booking_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained('bookings')->onDelete('cascade');
            $table->foreignId('court_id')->constrained('courts')->onDelete('restrict'); // Assigned randomly behind scenes
            $table->date('booking_date');
            $table->time('start_time');
            $table->time('end_time');
            $table->decimal('slot_price', 8, 2);
            $table->timestamps();

            $table->index(['booking_date', 'start_time', 'court_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('booking_items');
        Schema::dropIfExists('bookings');
        Schema::dropIfExists('tiered_pricing_rules');
        Schema::dropIfExists('court_closures');
        Schema::dropIfExists('courts');
    }
};

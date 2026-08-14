<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Slot times, opening hours, and the cancellation window are all stored and
 * compared as club-local wall-clock values. If the app runs on UTC while the
 * venue sits at UTC+4, the server believes it is four hours earlier than it
 * is: slots that already started stay bookable, and the six-hour cancellation
 * window shrinks to two in real terms.
 *
 * This pins the configuration itself rather than any one symptom, because the
 * offset leaks into every date comparison in the codebase.
 */
class ClubTimezoneTest extends TestCase
{
    public function test_the_application_runs_on_the_clubs_timezone(): void
    {
        $this->assertSame(
            'Asia/Muscat',
            config('app.timezone'),
            'The app must run on club-local time; UTC makes past slots bookable.'
        );
    }

    public function test_laravels_clock_agrees_with_the_club_wall_clock(): void
    {
        $clubNow = new \DateTime('now', new \DateTimeZone('Asia/Muscat'));

        $this->assertSame(
            $clubNow->format('Y-m-d H'),
            now()->format('Y-m-d H'),
            'now() drifted from the venue clock — check APP_TIMEZONE.'
        );
    }
}

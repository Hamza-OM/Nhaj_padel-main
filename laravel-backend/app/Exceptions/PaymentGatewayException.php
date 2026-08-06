<?php

namespace App\Exceptions;

use Exception;

/**
 * Raised when the payment provider cannot be reached or refuses a request.
 *
 * The message is for logs only — controllers translate this into a generic
 * customer-facing message so provider internals never reach the browser.
 */
class PaymentGatewayException extends Exception
{
}

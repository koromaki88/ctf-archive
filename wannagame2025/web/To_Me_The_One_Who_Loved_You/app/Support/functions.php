<?php

declare(strict_types=1);

use function Hyperf\Support\make as hyperf_make;

if (! function_exists('make')) {
    /**
     * Minimal helper to bridge packages that expect a global make().
     */
    function make(string $name, array $parameters = [])
    {
        return hyperf_make($name, $parameters);
    }
}

<?php

declare(strict_types=1);

namespace App\Model;

use Hyperf\DbConnection\Model\Model;

class User extends Model
{
    protected ?string $table = 'users';

    public bool $timestamps = false;

    protected array $fillable = [
        'username',
        'password',
        'created_at',
    ];

    protected array $hidden = [
        'password',
    ];
}

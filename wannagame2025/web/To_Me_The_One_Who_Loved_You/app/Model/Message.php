<?php

declare(strict_types=1);

namespace App\Model;

use Hyperf\DbConnection\Model\Model;

class Message extends Model
{
    protected ?string $table = 'messages';

    public bool $timestamps = false;

    protected array $fillable = [
        'sender_id',
        'recipient',
        'body',
        'encrypted',
        'created_at',
    ];
}

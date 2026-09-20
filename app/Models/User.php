<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'timezone',
        'secret_question',
        'secret_answer',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'secret_answer',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'secret_answer' => 'hashed',
        ];
    }

    public function days(): HasMany
    {
        return $this->hasMany(Day::class);
    }
}
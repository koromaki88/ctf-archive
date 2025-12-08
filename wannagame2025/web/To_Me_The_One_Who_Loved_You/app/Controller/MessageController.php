<?php

declare(strict_types=1);
/**
 * Message inbox/outbox endpoints.
 */

namespace App\Controller;

use App\Model\Message;
use App\Model\User;
use App\Support\AuthGuard;
use App\Support\DatabaseInitializer;

use function time;

class MessageController extends AbstractController
{
    public function index()
    {
        return $this->inbox();
    }

    public function received()
    {
        return $this->inbox();
    }

    private function inbox()
    {
        DatabaseInitializer::ensure();
        $user = AuthGuard::user($this->request);
        if (! $user) {
            return $this->response->json(['message' => 'Unauthorized'])->withStatus(401);
        }

        $messages = Message::query()
            ->where('recipient', $user->username)
            ->orderByDesc('id')
            ->limit(50)
            ->get(['id', 'sender_id', 'recipient', 'body', 'encrypted', 'created_at']);

        $senderIds = $messages->pluck('sender_id')->unique()->all();
        $senders = User::query()->whereIn('id', $senderIds)->pluck('username', 'id');

        $data = $messages->map(function (Message $m) use ($senders) {
            return [
                'id' => $m->id,
                'from' => $senders[$m->sender_id] ?? 'unknown',
                'to' => $m->recipient,
                'body' => $m->body,
                'encrypted' => (bool) $m->encrypted,
                'created_at' => $m->created_at,
            ];
        });

        return $this->response->json(['messages' => $data]);
    }

    public function sent()
    {
        DatabaseInitializer::ensure();
        $user = AuthGuard::user($this->request);
        if (! $user) {
            return $this->response->json(['message' => 'Unauthorized'])->withStatus(401);
        }

        $messages = Message::query()
            ->where('sender_id', $user->id)
            ->orderByDesc('id')
            ->limit(50)
            ->get(['id', 'sender_id', 'recipient', 'body', 'encrypted', 'created_at']);

        $data = $messages->map(function (Message $m) {
            return [
                'id' => $m->id,
                'to' => $m->recipient,
                'body' => $m->body,
                'encrypted' => (bool) $m->encrypted,
                'created_at' => $m->created_at,
            ];
        });

        return $this->response->json(['messages' => $data]);
    }

    public function store()
    {
        DatabaseInitializer::ensure();
        $user = AuthGuard::user($this->request);
        if (! $user) {
            return $this->response->json(['message' => 'Unauthorized'])->withStatus(401);
        }

        $recipient = trim((string) $this->request->input('to', ''));
        $body = (string) $this->request->input('message', '');
        $encrypted = (bool) $this->request->input('encrypted', false);

        if ($recipient === '' || $body === '') {
            return $this->response->json(['message' => 'Recipient and message are required.'])->withStatus(422);
        }

        $recipientUser = User::query()->where('username', $recipient)->first();
        if (! $recipientUser) {
            return $this->response->json(['message' => 'Recipient not found.'])->withStatus(404);
        }

        $message = new Message();
        $message->sender_id = (int) $user->id;
        $message->recipient = $recipientUser->username;
        $message->body = $body;
        $message->encrypted = $encrypted ? 1 : 0;
        $message->created_at = time();
        $message->save();

        return $this->response->json(['ok' => true, 'id' => $message->id]);
    }
}

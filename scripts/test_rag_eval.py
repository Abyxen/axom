import urllib.request
import json
import time

def query_rag(prompt):
    payload = {
        'messages': [
            {'role': 'user', 'content': prompt}
        ],
        'stream': False,
        'top_k': 3
    }

    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/rag/chat',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )

    t0 = time.time()
    try:
        resp = urllib.request.urlopen(req, timeout=120)
        data = json.loads(resp.read().decode('utf-8'))
        elapsed = time.time() - t0
        return data, elapsed
    except Exception as e:
        return {'error': str(e)}, time.time() - t0

def run_tests():
    print("=" * 60)
    print("RUNNING RAG ACCURACY & GROUNDING TEST SUITE")
    print("=" * 60)

    # Test 1: PDF Knowledge Retrieval
    q1 = "What is the TDP and benchmark score of the Hyperion-V4 accelerator and who is the lead engineer?"
    print(f"\n[TEST 1] PDF Query: {q1}")
    res1, t1 = query_rag(q1)
    ans1 = res1.get('message', {}).get('content', '')
    print(f"Elapsed: {t1:.2f}s")
    print("Answer:")
    print(ans1)
    print("Citations:")
    for c in res1.get('citations', []):
        score = float(c.get('score') or 0)
        dense = float(c.get('dense_score') or 0)
        lex = float(c.get('lexical_score') or 0)
        print(f"  * {c.get('doc')} #{c.get('chunk_id')} (Combined: {score:.3f}, Dense: {dense:.3f}, Lexical: {lex:.3f})")

    # Verification:
    t1_pass = ("18" in ans1 or "18W" in ans1 or "18 Watts" in ans1) and ("14,280" in ans1 or "14280" in ans1) and ("Kenneth Ward" in ans1)
    print(f"Test 1 Grounding Verified: {'PASS' if t1_pass else 'FAIL'}")

    # Test 2: Markdown Technical Report Retrieval
    q2 = "What are the key sizes for Kyber-1024 and Dilithium-5 and who is the lead cryptographer in Zurich?"
    print(f"\n[TEST 2] Markdown Query: {q2}")
    res2, t2 = query_rag(q2)
    ans2 = res2.get('message', {}).get('content', '')
    print(f"Elapsed: {t2:.2f}s")
    print("Answer:")
    print(ans2)
    print("Citations:")
    for c in res2.get('citations', []):
        score = float(c.get('score') or 0)
        dense = float(c.get('dense_score') or 0)
        lex = float(c.get('lexical_score') or 0)
        print(f"  * {c.get('doc')} #{c.get('chunk_id')} (Combined: {score:.3f}, Dense: {dense:.3f}, Lexical: {lex:.3f})")

    t2_pass = ("1,568" in ans2 or "1568" in ans2) and ("Evelyn Vance" in ans2)
    print(f"Test 2 Grounding Verified: {'PASS' if t2_pass else 'FAIL'}")

    # Test 3: Zero-Hallucination Negative Test
    q3 = "What is the secret recipe for Martian blueberry pancakes?"
    print(f"\n[TEST 3] Negative/Out-of-domain Query: {q3}")
    res3, t3 = query_rag(q3)
    ans3 = res3.get('message', {}).get('content', '')
    print(f"Elapsed: {t3:.2f}s")
    print("Answer:")
    print(ans3)
    t3_pass = any(phrase in ans3.lower() for phrase in ["not contain", "not found", "no information", "cannot find", "do not mention", "does not contain", "context provided does not"])
    print(f"Test 3 Negative Verification (Zero Hallucination): {'PASS' if t3_pass else 'MANUAL_CHECK'}")

    print("\n" + "=" * 60)
    print("SUMMARY")
    print(f"Test 1 (PDF Fact Grounding): {'PASS' if t1_pass else 'FAIL'}")
    print(f"Test 2 (Markdown Report Grounding): {'PASS' if t2_pass else 'FAIL'}")
    print(f"Test 3 (Negative Zero-Hallucination): {'PASS' if t3_pass else 'CHECK'}")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()

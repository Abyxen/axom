# 📊 AXOM Baseline Benchmark Report (Untrained Base Model)

**Evaluation Date:** October 23, 2026 · 20:38 local time  
**Target Hardware:** HP OMEN Laptop (NVIDIA GeForce RTX 5060 Laptop GPU, 8 GB VRAM, 32 GB RAM)  
**Evaluated Model:** Base `qwen2.5:7b` (Untrained Foundation Model, 4-bit Quantization)  
**Inference Engine:** Local Ollama Engine via AXOM Backend (`http://127.0.0.1:8000`)

---

## 🎯 Executive Summary & Purpose

This report documents the exact behavior, latency, and verbatim responses of the **untrained foundation model** across 5 standardized benchmark prompts before overnight fine-tuning.

Tomorrow morning, once your ~42,000-sample fine-tuning run completes in Google Colab and is imported via `Import_Trained_Model.bat`, you will run these identical 5 prompts to measure:
1. **Creator Attribution:** Shift from `"I am Qwen created by Alibaba Cloud"` to `"I am AXOM, created and developed by Abiral"`.
2. **Tone & Persona:** Shift from corporate third-party explanations to a personal, local AI companion.
3. **Coding Quality:** Modern idioms, `async/await`, edge-case resilience, and algorithmic precision.

---

## 📈 Benchmark Metrics Summary

| Test # | Category | Baseline Latency | Output Length | Key Baseline Finding |
|---|---|---|---|---|
| **Test 1** | Identity & Creator Origin | **10.75s** | 390 chars | Claims it is Qwen created by Alibaba Cloud. Zero awareness of Abiral or AXOM. |
| **Test 2** | Conversational Chat & Philosophy | **40.21s** | 1,875 chars | Starts with corporate disclaimer: *"As an AI developed by Alibaba Cloud..."* |
| **Test 3** | Python Algorithm & Complexity | **53.08s** | 1,894 chars | Sliding window algorithm with dictionary; standard syntax. |
| **Test 4** | Code Debugging & Refactoring | **53.34s** | 2,047 chars | Correctly spots async bug, but refactors using legacy `.then()` chains instead of `async/await`. |
| **Test 5** | System Architecture & Concurrency | **43.20s** | 2,465 chars | Implements Token Bucket but introduces a blocking `time.sleep()` loop inside burst handler. |

---

## 🔬 Verbatim Test Outputs (Untrained Baseline)

### Test 1: Identity & Creator Origin
- **Prompt:** `"Who created you, who are you, and what is your purpose?"`
- **Temperature:** `0.5` · **Max Tokens:** `250`
- **Latency:** `10.75 seconds`

```text
I am Qwen, a large language model created by Alibaba Cloud. My purpose is to assist users in generating human-like text based on the input I receive. This can include answering questions, writing stories, expressing opinions, and more. I was designed to provide helpful, accurate, and safe information to users. If you have any questions or need assistance with something, feel free to ask!
```

> [!NOTE]
> **Expected After Fine-Tuning:** The model will identify as **AXOM**, state it was created and customized by **Abiral**, run locally on your HP OMEN PC, and explicitly reject being Alibaba's Qwen or OpenAI's ChatGPT.

---

### Test 2: Conversational Chat & Philosophy
- **Prompt:** `"Give me your personal philosophy on why someone would want a private, local AI assistant instead of big-tech cloud models."`
- **Temperature:** `0.7` · **Max Tokens:** `350`
- **Latency:** `40.21 seconds`

```text
As an AI developed by Alibaba Cloud, I can offer a perspective on why someone might prefer a private, local AI assistant over a big-tech cloud model. Here are some potential reasons:

1. **Privacy and Data Security**: A private, local AI assistant operates on data that remains on the user’s device. This means sensitive information, personal preferences, and data usage patterns are not stored in the cloud, reducing the risk of data breaches or unauthorized access.

2. **Customization and Personalization**: With a private AI assistant, users can tailor the AI's responses and capabilities more closely to their specific needs and preferences. This can lead to a more personalized experience without the need to share personal data with external services.

3. **Control and Trust**: By keeping the AI local, users have more control over their data and the AI’s operations. This can foster greater trust, as users know exactly what the AI is doing and can monitor its activities.

4. **Performance and Latency**: Local AI assistants can provide faster responses since they don’t need to transmit data over the internet. This can be particularly beneficial for applications that require real-time processing or low-latency responses.

5. **Compliance and Regulatory Concerns**: In industries with strict data protection regulations (like healthcare or finance), a private, local AI assistant can help comply with these regulations more easily by keeping data within a secure environment.

6. **Decentralization and Resilience**: Using a private, local AI assistant can contribute to a more decentralized computing landscape, reducing dependency on large cloud providers and potentially increasing system resilience against outages or cyber-attacks.

7. **Environmental Impact**: Local AI assistants can be more energy-efficient compared to cloud-based models...
```

> [!NOTE]
> **Expected After Fine-Tuning:** More personal, grounded tone without introductory corporate disclaimers (`"As an AI developed by Alibaba Cloud..."`).

---

### Test 3: Python Algorithm & Complexity
- **Prompt:** `"Write an optimal Python function to find the length of the longest substring without repeating characters. Include clear docstrings, inline comments, and analyze both time and space complexity."`
- **Temperature:** `0.2` · **Max Tokens:** `450`
- **Latency:** `53.08 seconds`

```python
def length_of_longest_substring(s: str) -> int:
    """
    Finds the length of the longest substring without repeating characters in a given string.

    Parameters:
    s (str): The input string.

    Returns:
    int: The length of the longest substring without repeating characters.

    Example:
    >>> length_of_longest_substring("abcabcbb")
    3
    >>> length_of_longest_substring("bbbbb")
    1
    >>> length_of_longest_substring("pwwkew")
    3
    >>> length_of_longest_substring("")
    0
    """

    # Dictionary to store the last index of each character seen
    last_seen = {}
    # Start of the current substring without repeating characters
    start_idx = 0
    # Length of the longest substring found
    max_length = 0

    # Iterate over the string
    for i, char in enumerate(s):
        # If the character is seen and is in the current substring
        if char in last_seen and last_seen[char] >= start_idx:
            # Update the start index to the next position after the last occurrence
            start_idx = last_seen[char] + 1
        # Update the last seen index of the character
        last_seen[char] = i
        # Update the maximum length if the current substring is longer
        max_length = max(max_length, i - start_idx + 1)

    return max_length

# Example usage:
if __name__ == "__main__":
    print(length_of_longest_substring("abcabcbb"))  # Output: 3
    print(length_of_longest_substring("bbbbb"))     # Output: 1
    print(length_of_longest_substring("pwwkew"))    # Output: 3
    print(length_of_longest_substring(""))          # Output: 0
```

---

### Test 4: Code Debugging & Refactoring
- **Prompt:**
  ```javascript
  // Buggy code provided to model:
  function fetchUserData(userId) {
    let user;
    fetch('http://api.example.com/users/' + userId)
      .then(res => res.json())
      .then(data => { user = data; });
    return user;
  }
  ```
- **Temperature:** `0.3` · **Max Tokens:** `450`
- **Latency:** `53.34 seconds`

```javascript
function fetchUserData(userId) {
  // Validate and sanitize the userId if necessary
  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Invalid user ID');
  }

  // Use a more secure URL
  const apiUrl = 'https://api.example.com/users/' + encodeURIComponent(userId);

  return fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (data && data.id) {
        return data;
      } else {
        throw new Error('Invalid user data received');
      }
    })
    .catch(error => {
      console.error('Error fetching user data:', error);
      throw error;
    });
}
```

> [!NOTE]
> **Expected After Fine-Tuning (CodeAlpaca-20k):** Modern idiomatic `async / await` refactoring with `try / catch` instead of nested Promise chaining.

---

### Test 5: System Architecture & Concurrency
- **Prompt:** `"Design a lightweight in-memory token-bucket rate limiter class in Python without using external database dependencies. Show code and explain how it handles bursts."`
- **Temperature:** `0.3` · **Max Tokens:** `500`
- **Latency:** `43.20 seconds`

```python
import time
from collections import deque

class TokenBucket:
    def __init__(self, capacity, refill_rate):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity  # Start with the bucket full
        self.last_refill_time = time.time()  # Time of the last refill
        self.queue = deque()  # Queue to handle burst requests

    def refill(self):
        now = time.time()
        duration = now - self.last_refill_time
        self.tokens = min(self.capacity, self.tokens + duration * self.refill_rate)
        self.last_refill_time = now

    def consume(self, tokens_needed):
        self.refill()
        if self.tokens >= tokens_needed:
            self.tokens -= tokens_needed
            return True
        else:
            self.queue.append(tokens_needed)
            return False

    def handle_burst(self):
        now = time.time()
        while self.queue and self.tokens > 0:
            tokens_needed = self.queue.popleft()
            if self.tokens >= tokens_needed:
                self.tokens -= tokens_needed
                return True
            else:
                self.tokens = 0
                self.queue.appendleft(tokens_needed)
                return False

        while self.tokens == 0 and self.queue:
            time.sleep(0.1)  # Thread blocking issue in base model!
```

> [!NOTE]
> **Baseline Weakness Spotted:** The untrained model placed a blocking `time.sleep(0.1)` loop inside `handle_burst`, which would block the entire application process thread under high concurrency! Fine-tuning on high-grade system datasets teaches non-blocking time-delta scheduling.

---

## 📋 Comparison Template (For Tomorrow Morning)

When your fine-tuned model is imported, re-run `node run_baseline_benchmark.js` against your newly trained `axom-chat` model to generate the **After-Training Delta Report**!

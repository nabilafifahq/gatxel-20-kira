# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 2 |
| Low | 3 |
| Informational | 5 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Low | Warning |  | ZAP warnings logged - see the zap.log file for details | 4    |
| Info | Informational | http://10.77.0.1:3136 | Percentage of responses with status code 2xx | 63 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of responses with status code 3xx | 35 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of responses with status code 4xx | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type application/javascript | 36 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type application/manifest+json | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type image/png | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type image/svg+xml | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type image/x-icon | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type text/css | 1 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with content type text/html | 55 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with method GET | 92 % |
| Info | Informational | http://10.77.0.1:3136 | Percentage of endpoints with method POST | 7 % |
| Info | Informational | http://10.77.0.1:3136 | Count of total endpoints | 77    |
| Info | Informational | http://10.77.0.1:3136 | Percentage of slow responses | 74 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Absence of Anti-CSRF Tokens | Medium | Systemic |
| CSP: style-src unsafe-inline | Medium | Systemic |
| Big Redirect Detected (Potential Sensitive Information Leak) | Low | 3 |
| Cross-Origin-Embedder-Policy Header Missing or Invalid | Low | 2 |
| Cross-Origin-Resource-Policy Header Missing or Invalid | Low | Systemic |
| Authentication Request Identified | Informational | 3 |
| Modern Web Application | Informational | Systemic |
| Non-Storable Content | Informational | 4 |
| Storable and Cacheable Content | Informational | 5 |
| Storable but Non-Cacheable Content | Informational | 1 |




## Alert Detail



### [ Absence of Anti-CSRF Tokens ](https://www.zaproxy.org/docs/alerts/10202/)



##### Medium (Low)

### Description

No Anti-CSRF tokens were found in a HTML submission form.
A cross-site request forgery is an attack that involves forcing a victim to send an HTTP request to a target destination without their knowledge or intent in order to perform an action as the victim. The underlying cause is application functionality using predictable URL/form actions in a repeatable way. The nature of the attack is that CSRF exploits the trust that a web site has for a user. By contrast, cross-site scripting (XSS) exploits the trust that a user has for a web site. Like XSS, CSRF attacks are not necessarily cross-site, but they can be. Cross-site request forgery is also known as CSRF, XSRF, one-click attack, session riding, confused deputy, and sea surf.

CSRF attacks are effective in a number of situations, including:
    * The victim has an active session on the target site.
    * The victim is authenticated via HTTP auth on the target site.
    * The victim is on the same local network as the target site.

CSRF has primarily been used to perform an action against a target site using the victim's privileges, but recent techniques have been discovered to disclose information by gaining access to the response. The risk of information disclosure is dramatically increased when the target site is vulnerable to XSS, because XSS can be used as a platform for CSRF, allowing the attack to operate within the bounds of the same-origin policy.

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<form action="/keluar" method="post">`
  * Other Info: `No known Anti-CSRF token [anticsrf, CSRFToken, __RequestVerificationToken, csrfmiddlewaretoken, authenticity_token, OWASP_CSRFTOKEN, anoncsrf, csrf_token, _csrf, _csrfSecret, __csrf_magic, CSRF, _token, _csrf_token, _csrfToken] was found in the following HTML form: [Form 1: "" ].`
* URL: http://10.77.0.1:3136/konsol
  * Node Name: `http://10.77.0.1:3136/konsol`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<form action="/keluar" method="post">`
  * Other Info: `No known Anti-CSRF token [anticsrf, CSRFToken, __RequestVerificationToken, csrfmiddlewaretoken, authenticity_token, OWASP_CSRFTOKEN, anoncsrf, csrf_token, _csrf, _csrfSecret, __csrf_magic, CSRF, _token, _csrf_token, _csrfToken] was found in the following HTML form: [Form 1: "" ].`
* URL: http://10.77.0.1:3136/konsol/impor
  * Node Name: `http://10.77.0.1:3136/konsol/impor`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<form action="/keluar" method="post">`
  * Other Info: `No known Anti-CSRF token [anticsrf, CSRFToken, __RequestVerificationToken, csrfmiddlewaretoken, authenticity_token, OWASP_CSRFTOKEN, anoncsrf, csrf_token, _csrf, _csrfSecret, __csrf_magic, CSRF, _token, _csrf_token, _csrfToken] was found in the following HTML form: [Form 1: "" ].`
* URL: http://10.77.0.1:3136/konsol/impor
  * Node Name: `http://10.77.0.1:3136/konsol/impor`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<form noValidate="" class="flex flex-col gap-4" method="post">`
  * Other Info: `No known Anti-CSRF token [anticsrf, CSRFToken, __RequestVerificationToken, csrfmiddlewaretoken, authenticity_token, OWASP_CSRFTOKEN, anoncsrf, csrf_token, _csrf, _csrfSecret, __csrf_magic, CSRF, _token, _csrf_token, _csrfToken] was found in the following HTML form: [Form 2: "impor-label" "impor-milik" "pdf_R_3a5bsnpfivb_" "r_R_5ba5bsnpfivb_-english" "r_R_5ba5bsnpfivb_-math" "r_R_5ba5bsnpfivb_-science" "upload-bagian" "upload-menit" "upload-sumber" "upload-tahun" ].`
* URL: http://10.77.0.1:3136/konsol/koneksi-claude
  * Node Name: `http://10.77.0.1:3136/konsol/koneksi-claude`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<form action="/keluar" method="post">`
  * Other Info: `No known Anti-CSRF token [anticsrf, CSRFToken, __RequestVerificationToken, csrfmiddlewaretoken, authenticity_token, OWASP_CSRFTOKEN, anoncsrf, csrf_token, _csrf, _csrfSecret, __csrf_magic, CSRF, _token, _csrf_token, _csrfToken] was found in the following HTML form: [Form 1: "" ].`

Instances: Systemic


### Solution

Phase: Architecture and Design
Use a vetted library or framework that does not allow this weakness to occur or provides constructs that make this weakness easier to avoid.
For example, use anti-CSRF packages such as the OWASP CSRFGuard.

Phase: Implementation
Ensure that your application is free of cross-site scripting issues, because most CSRF defenses can be bypassed using attacker-controlled script.

Phase: Architecture and Design
Generate a unique nonce for each form, place the nonce into the form, and verify the nonce upon receipt of the form. Be sure that the nonce is not predictable (CWE-330).
Note that this can be bypassed using XSS.

Identify especially dangerous operations. When the user performs a dangerous operation, send a separate confirmation request to ensure that the user intended to perform that operation.
Note that this can be bypassed using XSS.

Use the ESAPI Session Management control.
This control includes a component for CSRF.

Do not use the GET method for any request that triggers a state change.

Phase: Implementation
Check the HTTP Referer header to see if the request originated from an expected page. This could break legitimate functionality, because users or proxies may have disabled sending the Referer for privacy reasons.

### Reference


* [ https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html ](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
* [ https://cwe.mitre.org/data/definitions/352.html ](https://cwe.mitre.org/data/definitions/352.html)


#### CWE Id: [ 352 ](https://cwe.mitre.org/data/definitions/352.html)


#### WASC Id: 9

#### Source ID: 3

### [ CSP: style-src unsafe-inline ](https://www.zaproxy.org/docs/alerts/10055/)



##### Medium (High)

### Description

Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks. Including (but not limited to) Cross Site Scripting (XSS), and data injection attacks. These attacks are used for everything from data theft to site defacement or distribution of malware. CSP provides a set of standard HTTP headers that allow website owners to declare approved sources of content that browsers should be allowed to load on that page — covered types are JavaScript, CSS, HTML frames, fonts, images and embeddable objects such as Java applets, ActiveX, audio and video files.

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-ZDc0NTQ4MTctMTE0ZS00ODE4LWE0ODUtMTBiYjI2ZjY3MTA2' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-ZDkzMjVhZmUtMzgxMC00OWM1LWI3MzYtMjNlNWI2Y2E0Nzc5' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/konsol
  * Node Name: `http://10.77.0.1:3136/konsol`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-YzY1NmZkMjItNTIxMC00ZWRlLTljMGYtZTIxYTNhNTZkN2Nj' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/robots.txt
  * Node Name: `http://10.77.0.1:3136/robots.txt`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-NzdkN2Q4YTctNzIyYi00YTYwLWExMWUtZTY4YTMxMWZiYzlm' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`
* URL: http://10.77.0.1:3136/sitemap.xml
  * Node Name: `http://10.77.0.1:3136/sitemap.xml`
  * Method: `GET`
  * Parameter: `content-security-policy`
  * Attack: ``
  * Evidence: `default-src 'self'; script-src 'self' 'nonce-MmIwOTllYzAtNGI4My00OTE5LWE4MDktMzUzNTk4NjRjOTM4' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`
  * Other Info: `style-src includes unsafe-inline.`

Instances: Systemic


### Solution

Ensure that your web server, application server, load balancer, etc. is properly configured to set the Content-Security-Policy header.

### Reference


* [ https://www.w3.org/TR/CSP/ ](https://www.w3.org/TR/CSP/)
* [ https://caniuse.com/#search=content+security+policy ](https://caniuse.com/#search=content+security+policy)
* [ https://content-security-policy.com/ ](https://content-security-policy.com/)
* [ https://github.com/HtmlUnit/htmlunit-csp ](https://github.com/HtmlUnit/htmlunit-csp)
* [ https://web.dev/articles/csp#resource-options ](https://web.dev/articles/csp#resource-options)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 15

#### Source ID: 3

### [ Big Redirect Detected (Potential Sensitive Information Leak) ](https://www.zaproxy.org/docs/alerts/10044/)



##### Low (Medium)

### Description

The server has responded with a redirect that seems to provide a large response. This may indicate that although the server sent a redirect it also responded with body content (which may include sensitive details, PII, etc.).

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 7 [/konsol].
Predicted response size: 307.
Response Body Length: 8,445.`
* URL: http://10.77.0.1:3136/konsol/bank-soal%3Fsoal=m1.count-on-back.001
  * Node Name: `http://10.77.0.1:3136/konsol/bank-soal (soal)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 33 [/masuk?next=%2Fkonsol%2Fbank-soal].
Predicted response size: 333.
Response Body Length: 9,359.`
* URL: http://10.77.0.1:3136/konsol/paper
  * Node Name: `http://10.77.0.1:3136/konsol/paper`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `Location header URI length: 29 [/masuk?next=%2Fkonsol%2Fpaper].
Predicted response size: 329.
Response Body Length: 9,137.`


Instances: 3

### Solution

Ensure that no sensitive information is leaked via redirect responses. Redirect responses should have almost no content.

### Reference



#### CWE Id: [ 201 ](https://cwe.mitre.org/data/definitions/201.html)


#### WASC Id: 13

#### Source ID: 3

### [ Cross-Origin-Embedder-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Embedder-Policy header is a response header that prevents a document from loading any cross-origin resources that don't explicitly grant the document permission (using CORP or CORS).

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/konsol
  * Node Name: `http://10.77.0.1:3136/konsol`
  * Method: `GET`
  * Parameter: `Cross-Origin-Embedder-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 2

### Solution

Ensure that the application/web server sets the Cross-Origin-Embedder-Policy header appropriately, and that it sets the Cross-Origin-Embedder-Policy header to 'require-corp' for documents.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Embedder-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-embedder-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Cross-Origin-Resource-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Resource-Policy header is an opt-in header designed to counter side-channels attacks like Spectre. Resource should be specifically set as shareable amongst different origins.

* URL: http://10.77.0.1:3136/_next/static/chunks/0z_e_51u4wy84.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/0z_e_51u4wy84.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/turbopack-2c3mg3r-05n1w.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/turbopack-2c3mg3r-05n1w.js`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``

Instances: Systemic


### Solution

Ensure that the application/web server sets the Cross-Origin-Resource-Policy header appropriately, and that it sets the Cross-Origin-Resource-Policy header to 'same-origin' for all web pages.
'same-site' is considered as less secured and should be avoided.
If resources must be shared, set the header to 'cross-origin'.
If possible, ensure that the end user uses a standards-compliant and modern web browser that supports the Cross-Origin-Resource-Policy header (https://caniuse.com/mdn-http_headers_cross-origin-resource-policy).

### Reference


* [ https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy ](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)


#### CWE Id: [ 693 ](https://cwe.mitre.org/data/definitions/693.html)


#### WASC Id: 14

#### Source ID: 3

### [ Authentication Request Identified ](https://www.zaproxy.org/docs/alerts/10111/)



##### Informational (Low)

### Description

The given request has been identified as an authentication request. The 'Other Info' field contains a set of key=value lines which identify any relevant fields. If the request is in a context which has an Authentication Method set to "Auto-Detect" then this rule will change the authentication to match the request identified.

* URL: http://10.77.0.1:3136/masuk
  * Node Name: `http://10.77.0.1:3136/masuk ()(email,password)`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password
referer=http://10.77.0.1:3136/masuk`
* URL: http://10.77.0.1:3136/masuk%3Fnext=%252Fkonsol%252Fpaper
  * Node Name: `http://10.77.0.1:3136/masuk (next)(email,password)`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password
referer=http://10.77.0.1:3136/masuk?next=%2Fkonsol%2Fpaper`
* URL: http://10.77.0.1:3136/masuk%3Fnotice=signed-out
  * Node Name: `http://10.77.0.1:3136/masuk (notice)(email,password)`
  * Method: `POST`
  * Parameter: `email`
  * Attack: ``
  * Evidence: `password`
  * Other Info: `userParam=email
userValue=zaproxy@example.com
passwordParam=password
referer=http://10.77.0.1:3136/masuk?notice=signed-out`


Instances: 3

### Solution

This is an informational alert rather than a vulnerability and so there is nothing to fix.

### Reference


* [ https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/ ](https://www.zaproxy.org/docs/desktop/addons/authentication-helper/auth-req-id/)



#### Source ID: 3

### [ Modern Web Application ](https://www.zaproxy.org/docs/alerts/10109/)



##### Informational (Medium)

### Description

The application appears to be a modern web application. If you need to explore it automatically then the Client Spider may well be more effective than the standard one.

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="ZDkzMjVhZmUtMzgxMC00OWM1LWI3MzYtMjNlNWI2Y2E0Nzc5"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/konsol/bank-soal%3Fsoal=m1.count-on-back.001
  * Node Name: `http://10.77.0.1:3136/konsol/bank-soal (soal)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="NWNiNTg1YTktMzhlOC00YTkwLTliNjktY2IxYzNhMzYwZjI2"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/konsol/bank-soal%3Fsoal=gen%253Am1.count-objects%253A2
  * Node Name: `http://10.77.0.1:3136/konsol/bank-soal (soal)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="NmUwMzFhZmQtY2Q0ZC00YTNmLTk0YjgtZDNkMWUxNzQxYWNk"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/konsol/bank-soal%3Fsoal=gen%253Am1.count-objects%253A1
  * Node Name: `http://10.77.0.1:3136/konsol/bank-soal (soal)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="ODNiOGE4N2ItYmRiOS00YTM3LThiYjktZGM1YmIwZWQyNDEy"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`
* URL: http://10.77.0.1:3136/konsol/bank-soal%3Fsoal=gen%253Am1.number-names%253A4
  * Node Name: `http://10.77.0.1:3136/konsol/bank-soal (soal)`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `<script src="/_next/static/chunks/0z_e_51u4wy84.js" async="" nonce="ZDVkMDFjYmYtNTkxMi00NWFiLWEzZjgtMDRmM2NhMWU1NGE2"></script>`
  * Other Info: `No links have been found while there are scripts, which is an indication that this is a modern web application.`

Instances: Systemic


### Solution

This is an informational alert and so no changes are required.

### Reference




#### Source ID: 3

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://10.77.0.1:3136/
  * Node Name: `http://10.77.0.1:3136/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://10.77.0.1:3136/konsol
  * Node Name: `http://10.77.0.1:3136/konsol`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://10.77.0.1:3136/robots.txt
  * Node Name: `http://10.77.0.1:3136/robots.txt`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://10.77.0.1:3136/sitemap.xml
  * Node Name: `http://10.77.0.1:3136/sitemap.xml`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``


Instances: 4

### Solution

The content may be marked as storable by ensuring that the following conditions are satisfied:
The request method must be understood by the cache and defined as being cacheable ("GET", "HEAD", and "POST" are currently defined as cacheable)
The response status code must be understood by the cache (one of the 1XX, 2XX, 3XX, 4XX, or 5XX response classes are generally understood)
The "no-store" cache directive must not appear in the request or response header fields
For caching by "shared" caches such as "proxy" caches, the "private" response directive must not appear in the response
For caching by "shared" caches such as "proxy" caches, the "Authorization" header field must not appear in the request, unless the response explicitly allows it (using one of the "must-revalidate", "public", or "s-maxage" Cache-Control response directives)
In addition to the conditions above, at least one of the following conditions must also be satisfied by the response:
It must contain an "Expires" header field
It must contain a "max-age" response directive
For "shared" caches such as "proxy" caches, it must contain a "s-maxage" response directive
It must contain a "Cache Control Extension" that allows it to be cached
It must have a status code that is defined as cacheable by default (200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501).

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable and Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, and may be retrieved directly from the cache, rather than from the origin server by the caching servers, in response to similar requests from other users. If the response data is sensitive, personal or user-specific, this may result in sensitive information being leaked. In some cases, this may even result in a user gaining complete control of the session of another user, depending on the configuration of the caching components in use in their environment. This is primarily an issue where "shared" caching servers such as "proxy" caches are configured on the local network. This configuration is typically found in corporate or educational environments, for instance.

* URL: http://10.77.0.1:3136/_next/static/chunks/0z_e_51u4wy84.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/0z_e_51u4wy84.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/176na8y6-lw9-.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/1_g66hkhn9a15.css`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/3wrrzfq13dxk_.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``
* URL: http://10.77.0.1:3136/_next/static/chunks/turbopack-2c3mg3r-05n1w.js
  * Node Name: `http://10.77.0.1:3136/_next/static/chunks/turbopack-2c3mg3r-05n1w.js`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=31536000`
  * Other Info: ``


Instances: 5

### Solution

Validate that the response does not contain sensitive, personal or user-specific information. If it does, consider the use of the following HTTP response headers, to limit, or prevent the content being stored and retrieved from the cache by another user:
Cache-Control: no-cache, no-store, must-revalidate, private
Pragma: no-cache
Expires: 0
This configuration directs both HTTP 1.0 and HTTP 1.1 compliant caching servers to not store the response, and to not retrieve the response (without validation) from the cache, in response to a similar request.

### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3

### [ Storable but Non-Cacheable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are storable by caching components such as proxy servers, but will not be retrieved directly from the cache, without validating the request upstream, in response to similar requests from other users.

* URL: http://10.77.0.1:3136/icons/apple-touch-icon.png
  * Node Name: `http://10.77.0.1:3136/icons/apple-touch-icon.png`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `max-age=0`
  * Other Info: ``


Instances: 1

### Solution



### Reference


* [ https://datatracker.ietf.org/doc/html/rfc7234 ](https://datatracker.ietf.org/doc/html/rfc7234)
* [ https://datatracker.ietf.org/doc/html/rfc7231 ](https://datatracker.ietf.org/doc/html/rfc7231)
* [ https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html ](https://www.w3.org/Protocols/rfc2616/rfc2616-sec13.html)


#### CWE Id: [ 524 ](https://cwe.mitre.org/data/definitions/524.html)


#### WASC Id: 13

#### Source ID: 3



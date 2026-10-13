#!/bin/bash
# usage: kq.sh CAS  -> saves k_<CAS>_list.html and detail
cas=$1; cd /tmp/claude-0/ral
H="-A Mozilla/5.0 -b cj -c cj -e https://msds.kosha.or.kr/MSDSInfo/kcic/msdssearchMsds.do"
curl -sS -m 40 $H -o "l_$cas.html" -d "viewType=&listType=msds&pageIndex=1&chem_id=&pageSize=10&chkAgree=Y&searchCondition=cas_no&searchKeyword=$cas" https://msds.kosha.or.kr/MSDSInfo/kcic/msdssearchMsds.do
ids=$(grep -o "getDetail('msds','[0-9A-Z]*')" "l_$cas.html" | sed -E "s/.*'msds','([^']*)'.*/\1/")
echo "$cas -> $ids"
for id in $ids; do
 curl -sS -m 40 $H -o "d_${cas}_$id.html" -d "viewType=msds&listType=msds&pageIndex=1&chem_id=$id&pageSize=10&chkAgree=Y&searchCondition=cas_no&searchKeyword=$cas" https://msds.kosha.or.kr/MSDSInfo/kcic/msdsdetail.do
 ls -la "d_${cas}_$id.html" | awk '{print $5,$9}'
done

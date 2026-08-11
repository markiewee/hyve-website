-- Chinese copy for the three properties and every room that carries a
-- description. Written to sell rather than transliterated, and using the same
-- vocabulary the dictionaries already settled on: 主人房 / 高级房 / 标准房,
-- 双人床 / 加大单人床, 独立卫浴, and the established station names 实龙岗 /
-- 裕廊东 / 汤申上段.
--
-- One correction carried in rather than copied: the English CP description
-- says "4-bedroom apartment" and Chiltern Park has six lettable rooms. The
-- Chinese says six. The English is wrong and is left for a separate fix so this
-- migration stays a translation.
--
-- Idempotent: keyed on code and unit_code, safe to re-run.

update public.properties set
  description_zh = '位于实龙岗（Serangoon）安静住宅区的宽敞公寓，共6间房。步行即可到 NEX 商场和实龙岗地铁站，前往市区通勤方便，适合上班族和留学生。'
where code = 'CP';

update public.properties set
  description_zh = '位于裕廊东（Jurong East）的现代化公寓，紧邻 JEM 和 Westgate 商场。裕廊东地铁站是南北线与东西线的换乘站，交通十分方便，适合在裕廊商业区上班或在附近上学的租客。'
where code = 'IH';

update public.properties set
  description_zh = '位于汤申上段（Upper Thomson）的排屋，社区安静、绿意盎然，出门即可乘坐汤申-东海岸线。喜欢亲近自然的租客，步行不远就是麦里芝蓄水池。'
where code = 'TG';

-- Same array order as house_rules, so the two can be diffed line by line.
update public.properties set
  house_rules_zh = '["室内禁止吸烟","安静时间：晚上10点至早上8点","可带访客，请提前告知室友","可养宠物","使用后请保持公共区域整洁","仅限简单烹饪","禁止任何违法活动"]'::jsonb
where code in ('CP', 'IH', 'TG');

update public.rooms set description_zh = case unit_code
  when 'CP-MR'   then '宽敞主人房，配双人床和独立卫浴。'
  when 'CP-PR1'  then '高级房，配加大单人床和衣柜。'
  when 'CP-PR2'  then '舒适高级房，配加大单人床和衣柜。'
  when 'CP-PR3'  then '空间充裕的高级房，配加大单人床和衣柜。'
  when 'CP-PR4'  then '明亮高级房，通风良好。'
  when 'CP-STD1' then '精巧标准房，配加大单人床，性价比高。'
  when 'IH-PR1'  then '位于裕廊东的高级房，生活配套齐全。'
  when 'IH-PR2'  then '采光良好的高级房，配书桌工作区。'
  when 'IH-PR3'  then '舒适高级房，紧邻公共区域。'
  when 'IH-STD1' then '位于裕廊东的标准房，配加大单人床。'
  when 'IH-STD2' then '标准房，配加大单人床，自然采光好。'
  when 'IH-STD3' then '位于裕廊东的标准房，性价比高。'
  when 'IH-STD4' then '宽敞标准房，配加大单人床。'
  when 'TG-MR'   then '宽敞主人房，配双人床和独立卫浴，位于安静的排屋内。'
  when 'TG-PR1'  then '排屋内的高级房，可使用花园。'
  when 'TG-PR2'  then '高级房，自然采光好。'
  when 'TG-PR3'  then '温馨高级房，位于汤申社区。'
  when 'TG-STD1' then '精巧标准房，位于安静的汤申社区。'
  when 'TG-STD2' then '温馨标准房，配单人床。'
end
where unit_code in (
  'CP-MR','CP-PR1','CP-PR2','CP-PR3','CP-PR4','CP-STD1',
  'IH-PR1','IH-PR2','IH-PR3','IH-STD1','IH-STD2','IH-STD3','IH-STD4',
  'TG-MR','TG-PR1','TG-PR2','TG-PR3','TG-STD1','TG-STD2'
);

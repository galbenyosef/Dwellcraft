'use client';
import { useState } from 'react';
import { ArrowUpRight, Box, Check, MoveRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import Studio from '@/components/studio';
const homes = [
  {
    id: 'home100',
    name: '日光小家',
    tag: 'THE WARM RETREAT',
    area: '100',
    rooms: '三室两厅 · 奶油风',
    image: 'home-100.png',
    desc: '把温暖，放进每一个日常。',
  },
  {
    id: 'home200',
    name: '林景大平层',
    tag: 'THE OPEN RESIDENCE',
    area: '200',
    rooms: '四室两厅 · 小清新',
    image: 'home-200.png',
    desc: '让自然与生活，自由相连。',
  },
  {
    id: 'estate',
    name: '湖畔庄园',
    tag: 'THE LAKESIDE ESTATE',
    area: '4000',
    rooms: '两层别墅 · 奢华风',
    image: 'estate-4000.png',
    desc: '在更广阔的空间，安放想象。',
  },
];
export default function Home() {
  const [chosen, setChosen] = useState('home100');
  const [active, setActive] = useState<string | null>(null);
  if (active)
    return (
      <Studio
        key={active}
        home={active as 'home100' | 'home200' | 'estate'}
        onExit={() => setActive(null)}
      />
    );
  return (
    <main className="home-screen">
      <header className="home-header">
        <Link className="brand" href="/">
          <Box size={26} />
          <b>
            Dwellcraft<span>住进想象</span>
          </b>
        </Link>
        <span className="edition">YOUR HOME, YOUR WAY.</span>
        <span className="status-pill">
          <i /> 本机保存 · 无需登录
        </span>
      </header>
      <section className="home-main">
        <div className="home-heading">
          <div>
            <p className="overline">A SPACE TO MAKE YOUR OWN</p>
            <h1>
              你的下一个家，<em>由你定义。</em>
            </h1>
            <p className="home-subtitle">选择一处空间，从第一件家具开始。</p>
          </div>
          <div className="collection-note">
            <span>01 — 03</span>
            <p>
              三个空间
              <br />
              无限种生活方式
            </p>
          </div>
        </div>
        <div className="home-grid">
          {homes.map((h, i) => (
            <button
              key={h.id}
              onClick={() => setChosen(h.id)}
              className={'home-card ' + (chosen === h.id ? 'is-picked' : '')}
              aria-pressed={chosen === h.id}
            >
              <div className="home-cover">
                <Image
                  unoptimized
                  width={1600}
                  height={1200}
                  src={'/concepts/' + h.image}
                  alt={h.rooms + '空间概念'}
                />
                <span className="card-no">0{i + 1}</span>
                <span className="card-check">
                  {chosen === h.id ? (
                    <Check size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </span>
                <div className="cover-area">
                  <strong>{h.area}</strong>
                  <span>㎡{h.id === 'estate' ? ' / 总占地' : ''}</span>
                </div>
              </div>
              <div className="home-card-copy">
                <p className="overline">{h.tag}</p>
                <div className="card-title">
                  <h2>{h.name}</h2>
                  <ArrowUpRight size={22} />
                </div>
                <p className="room-label">{h.rooms}</p>
                <p className="card-desc">{h.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="home-bottom">
          <p>从空房开始，或让风格样板间给你一点灵感。</p>
          <Button className="enter-button" onClick={() => setActive(chosen)}>
            进入{homes.find((h) => h.id === chosen)?.name}
            <MoveRight size={20} />
          </Button>
        </div>
      </section>
      <footer className="home-footer">
        <span>DWELLCRAFT / CREATIVE LIVING</span>
        <span>自由布置 · 真实尺度 · 沉浸漫游</span>
      </footer>
    </main>
  );
}

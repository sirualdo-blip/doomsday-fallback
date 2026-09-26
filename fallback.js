(function () {
    'use strict';

    var root = document.documentElement;

    if (!root.classList.contains('doomsday-fallback')) return;

    var PROFILE_DONE = 'doomsdayFallbackProfileReady';
    var votesByPost = Object.create(null);
    var votesRequest = null;
    var refreshTimer = null;

    function numberFrom(element) {
        var match = element && element.textContent.match(/[+-]?\d+/);

        return match ? match[0].replace(/^\+/, '') : null;
    }

    function makeStat(label, value, className) {
        if (value === null) return null;

        var item = document.createElement('span');
        var caption = document.createElement('span');
        var number = document.createElement('strong');

        item.className = 'doomsday-fallback-stat ' + className;
        item.setAttribute('title', label + ': ' + value);

        caption.className = 'doomsday-fallback-stat-label';
        caption.textContent = label;

        number.className = 'doomsday-fallback-stat-value';
        number.textContent = value;

        item.appendChild(caption);
        item.appendChild(number);

        return item;
    }

    function prepareProfile(author) {
        if (!author || author.dataset[PROFILE_DONE] === '1') return;

        var list = author.querySelector(':scope > ul');

        if (!list) return;

        var posts = list.querySelector('.pa-posts');
        var respect = list.querySelector('.pa-respect');
        var episodes = list.querySelector('.pa-fld5');
        var money = list.querySelector('.pa-fld8');
        var stats = document.createElement('li');

        stats.className = 'doomsday-fallback-profile-stats';

        [
            makeStat('Сообщения', numberFrom(posts), 'is-posts'),
            makeStat('Репутация', numberFrom(respect), 'is-respect'),
            makeStat('Игры', numberFrom(episodes), 'is-episodes'),
            makeStat('Галлеоны', numberFrom(money), 'is-money')
        ].forEach(function (item) {
            if (item) stats.appendChild(item);
        });

        [
            posts,
            respect,
            episodes,
            money,
            list.querySelector('.pa-fld1'),
            list.querySelector('.pa-fld2'),
            list.querySelector('.pa-fld6'),
            list.querySelector('.pa-fld7'),
            list.querySelector('.pa-ua'),
            list.querySelector('.pa-gifts'),
            list.querySelector('.pa-awards')
        ].forEach(function (element) {
            if (element) {
                element.classList.add('doomsday-fallback-profile-source');
            }
        });

        list.querySelectorAll('.fld-name').forEach(function (label) {
            var field = label.parentElement;

            if (
                field &&
                field.matches('.pa-author, .pa-fld3, .pa-fld4')
            ) {
                label.classList.add('doomsday-fallback-profile-source');
            }
        });

        list.querySelectorAll('.pa-fld3 [style], .pa-fld4 [style]').forEach(function (element) {
            element.style.removeProperty('font-family');
            element.style.removeProperty('font-size');

            if (!element.getAttribute('style')) element.removeAttribute('style');
        });

        if (stats.childElementCount) list.appendChild(stats);

        author.classList.add('doomsday-fallback-profile');
        author.dataset[PROFILE_DONE] = '1';
    }

    function fallbackAvatar(name) {
        var placeholder = document.createElement('span');

        placeholder.className = 'doomsday-fallback-like-avatar';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.textContent = (name || '?').trim().charAt(0).toUpperCase();

        return placeholder;
    }

    function safeAvatarUrl(rawUrl) {
        if (!rawUrl || /forumstatic\.ru/i.test(rawUrl)) return '';

        try {
            var url = new URL(rawUrl, window.location.href);
            return /^https?:$/.test(url.protocol) ? url.href : '';
        } catch (_) {
            return '';
        }
    }

    function likerLink(liker) {
        var name = liker.username || 'Пользователь';
        var link = document.createElement('a');
        var avatarUrl = safeAvatarUrl(liker.avatar);
        var avatar;

        link.href = '/profile.php?id=' + encodeURIComponent(liker.user_id || '');
        link.rel = 'nofollow';
        link.title = name;
        link.setAttribute('aria-label', name);

        if (avatarUrl) {
            avatar = document.createElement('img');
            avatar.src = avatarUrl;
            avatar.alt = '';
            avatar.loading = 'lazy';
            avatar.addEventListener('error', function () {
                avatar.replaceWith(fallbackAvatar(name));
            }, { once: true });
        } else {
            avatar = fallbackAvatar(name);
        }

        link.appendChild(avatar);

        var caption = document.createElement('span');
        caption.textContent = name;
        link.appendChild(caption);

        return link;
    }

    function renderLikers(post, popover) {
        var postId = (post.id || '').replace(/^p/, '');
        var likers = votesByPost[postId];
        var grid = popover.querySelector('.doomsday-fallback-like-grid');

        grid.replaceChildren();

        if (!Array.isArray(likers)) {
            grid.classList.add('is-empty');
            grid.textContent = votesRequest ? 'Загрузка…' : 'Список временно недоступен';
            return;
        }

        if (!likers.length) {
            grid.classList.add('is-empty');
            grid.textContent = 'Пока никто';
            return;
        }

        grid.classList.remove('is-empty');
        likers.forEach(function (liker) {
            grid.appendChild(likerLink(liker));
        });
    }

    function makePopover(post, rating) {
        var popover = rating.querySelector(':scope > .doomsday-fallback-like-popover');

        if (popover) return popover;

        popover = document.createElement('div');
        popover.className = 'doomsday-fallback-like-popover';
        popover.setAttribute('role', 'tooltip');
        popover.innerHTML = '<strong>Оценили</strong><div class="doomsday-fallback-like-grid is-empty">Загрузка…</div>';
        rating.appendChild(popover);

        function open() {
            renderLikers(post, popover);
            popover.classList.add('is-open');
        }

        function close(event) {
            if (event && event.type === 'focusout' && rating.contains(event.relatedTarget)) return;
            popover.classList.remove('is-open');
        }

        rating.addEventListener('mouseenter', open);
        rating.addEventListener('mouseleave', close);
        rating.addEventListener('focusin', open);
        rating.addEventListener('focusout', close);

        return popover;
    }

    function prepareLikes(post) {
        var rating = post && post.querySelector('.post-rating');
        var vote = post && post.querySelector('.post-vote');

        if (!rating) return;

        rating.classList.add('doomsday-fallback-like-control');

        var ratingLink = rating.querySelector('p > a');

        if (ratingLink) {
            ratingLink.title = 'Плюс без комментария';
            ratingLink.setAttribute('aria-label', 'Поставить плюс. Сейчас: ' + (numberFrom(ratingLink) || '0'));
        }

        if (vote) {
            vote.classList.add('doomsday-fallback-like-comment');

            var voteLink = vote.querySelector('p > a');

            if (voteLink) {
                voteLink.title = 'Плюс с комментарием';
                voteLink.setAttribute('aria-label', 'Поставить плюс с комментарием');
            }
        }

        makePopover(post, rating);
    }

    function collectPosts() {
        var posts = Array.from(document.querySelectorAll('#pun-viewtopic .post'));

        posts.forEach(function (post) {
            prepareProfile(post.querySelector('.post-author'));
            prepareLikes(post);
        });

        return posts;
    }

    function loadVotes(posts) {
        var postIds = posts.map(function (post) {
            return (post.id || '').replace(/^p/, '');
        }).filter(Boolean);

        if (!postIds.length || typeof window.fetch !== 'function') return;

        var params = new URLSearchParams({
            method: 'post.getVotesByPosts',
            post_id: postIds.join(','),
            fields: 'post_id,user_id,username,avatar,value,datetime',
            sort_dir: 'desc'
        });

        votesRequest = window.fetch('/api.php?' + params.toString(), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        }).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        }).then(function (data) {
            votesByPost = Object.create(null);

            var response = data.response || [];
            var postDataList = Array.isArray(response)
                ? response
                : Object.keys(response).map(function (key) {
                    return response[key];
                });

            postDataList.forEach(function (postData) {
                votesByPost[String(postData.post_id)] = (postData.votes || []).filter(function (vote) {
                    return Number(vote.value) === 1;
                });
            });
        }).catch(function () {
            votesByPost = Object.create(null);
        }).finally(function () {
            votesRequest = null;

            document.querySelectorAll('.doomsday-fallback-like-popover.is-open').forEach(function (popover) {
                var post = popover.closest('.post');
                if (post) renderLikers(post, popover);
            });
        });
    }

    function refresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(function () {
            loadVotes(collectPosts());
        }, 0);
    }

    function init() {
        refresh();

        if (typeof window.MutationObserver === 'function' && document.body) {
            new window.MutationObserver(function (records) {
                var needsRefresh = records.some(function (record) {
                    return Array.from(record.addedNodes).some(function (node) {
                        return node.nodeType === 1 && (
                            node.matches('.post, .post-author, .post-rating') ||
                            node.querySelector('.post, .post-author, .post-rating')
                        );
                    });
                });

                if (needsRefresh) refresh();
            }).observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
